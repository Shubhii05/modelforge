from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.datasets import get_db
from app.core.database import Base
from app.main import app


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base.metadata.create_all(engine)


def override_db():
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = override_db
client = TestClient(app)


def test_upload_profile_and_suggestions(tmp_path: Path, monkeypatch) -> None:
    from app.api import datasets
    monkeypatch.setattr(datasets, "DATASET_DIR", tmp_path)
    response = client.post("/api/datasets?filename=issues.csv", content=b"age,group,label\n1,a,yes\n2,a,yes\n100,b,no\n, b,no\n")
    assert response.status_code == 201
    dataset_id = response.json()["id"]
    profile = client.get(f"/api/datasets/{dataset_id}/profile")
    assert profile.status_code == 200
    result = profile.json()
    assert result["rows"] == 4
    assert next(c for c in result["column_profiles"] if c["name"] == "age")["missing_percent"] == 25
    assert result["class_imbalance"]
    cards = client.get(f"/api/datasets/{dataset_id}/suggestions").json()
    assert cards and all("fix_block" in card for card in cards)


def test_reject_non_csv() -> None:
    response = client.post("/api/datasets?filename=data.json", content=b"{}")
    assert response.status_code == 400
