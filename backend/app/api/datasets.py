import shutil
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import DATASET_DIR, MAX_DATASET_BYTES, ROOT_DIR
from app.core.database import SessionLocal
from app.models.dataset import Dataset
from app.profiler.profile import profile_csv
from app.schemas.dataset import DatasetOut, DatasetProfile, SuggestionCard
from app.services.suggestions import suggestions_for

router = APIRouter(prefix="/datasets", tags=["datasets"])

SAMPLES_DIR = ROOT_DIR / "backend" / "samples"

SAMPLE_CATALOG = [
    {
        "key": "iris",
        "name": "Iris Classification",
        "filename": "iris.csv",
        "rows": 150,
        "cols": 5,
        "target_column": "species",
        "description": "Predict iris flower species (setosa, versicolor, virginica) from measurements.",
    },
    {
        "key": "titanic",
        "name": "Titanic Survival",
        "filename": "titanic.csv",
        "rows": 250,
        "cols": 8,
        "target_column": "survived",
        "description": "Predict passenger survival with demographic and ticket information.",
    },
    {
        "key": "customer_churn",
        "name": "Customer Churn",
        "filename": "customer_churn.csv",
        "rows": 300,
        "cols": 7,
        "target_column": "churn",
        "description": "Predict whether a customer cancels subscription based on contract & charges.",
    },
    {
        "key": "credit_default",
        "name": "Credit Default",
        "filename": "credit_default.csv",
        "rows": 300,
        "cols": 7,
        "target_column": "default_payment",
        "description": "Assess credit default risk using age, credit limit, and payment history.",
    },
]


class SampleDatasetInfo(BaseModel):
    key: str
    name: str
    filename: str
    rows: int
    cols: int
    target_column: str
    description: str


def get_db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@router.get("/samples", response_model=list[SampleDatasetInfo])
def list_samples() -> list[SampleDatasetInfo]:
    return [SampleDatasetInfo(**item) for item in SAMPLE_CATALOG]


@router.post("/sample/{sample_key}", response_model=DatasetOut, status_code=201)
def load_sample_dataset(sample_key: str, db: Session = Depends(get_db)) -> Dataset:
    matched = next((s for s in SAMPLE_CATALOG if s["key"] == sample_key or s["filename"] == sample_key), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Sample dataset '{sample_key}' not found")

    sample_src = SAMPLES_DIR / matched["filename"]
    if not sample_src.is_file():
        raise HTTPException(status_code=500, detail="Sample dataset file is missing on server")

    target = DATASET_DIR / matched["filename"]
    if not target.exists():
        shutil.copyfile(sample_src, target)

    existing = db.scalar(select(Dataset).where(Dataset.filename == matched["filename"]))
    if existing:
        return existing

    item = Dataset(
        name=matched["name"],
        filename=matched["filename"],
        path=str(target),
        size_bytes=target.stat().st_size,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("", response_model=DatasetOut, status_code=201)
async def upload_dataset(request: Request, filename: str = Query(...), db: Session = Depends(get_db)) -> Dataset:
    safe_name = Path(filename).name
    if not safe_name.lower().endswith(".csv") or safe_name in {"", ".csv"}:
        raise HTTPException(status_code=400, detail="Upload a CSV file")
    existing = db.scalar(select(Dataset).where(Dataset.filename == safe_name))
    if existing:
        raise HTTPException(status_code=409, detail="A dataset with this filename already exists")
    payload = await request.body()
    if not payload or len(payload) > MAX_DATASET_BYTES:
        raise HTTPException(status_code=413, detail="Dataset is empty or exceeds the 25 MB limit")
    target = DATASET_DIR / safe_name
    try:
        target.write_bytes(payload)
        pd.read_csv(target, nrows=5)
    except (OSError, pd.errors.ParserError, UnicodeDecodeError) as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Could not parse uploaded CSV") from exc
    item = Dataset(name=Path(safe_name).stem, filename=safe_name, path=str(target), size_bytes=len(payload))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=list[DatasetOut])
def list_datasets(db: Session = Depends(get_db)) -> list[Dataset]:
    return list(db.scalars(select(Dataset).order_by(Dataset.created_at.desc())))


@router.get("/{dataset_id}/profile", response_model=DatasetProfile)
def get_profile(dataset_id: int, db: Session = Depends(get_db)) -> DatasetProfile:
    item = db.get(Dataset, dataset_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        return profile_csv(Path(item.path), item.id)
    except (OSError, pd.errors.ParserError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=422, detail="Dataset could not be profiled") from exc


@router.get("/{dataset_id}/suggestions", response_model=list[SuggestionCard])
def get_suggestions(dataset_id: int, db: Session = Depends(get_db)) -> list[SuggestionCard]:
    item = db.get(Dataset, dataset_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return suggestions_for(profile_csv(Path(item.path), item.id))
