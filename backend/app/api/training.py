from pathlib import Path
from typing import cast

import joblib
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session

from app.api.datasets import get_db
from app.core.database import SessionLocal
from app.models.dataset import Dataset
from app.models.pipeline import Pipeline
from app.models.training_run import TrainingRun
from app.schemas.training import (
    ClassProbability, Prediction, PredictionRequest, PredictionResponse,
    TrainingError, TrainingStarted, TrainRequest,
)
from app.services.training import train_pipeline_events

router = APIRouter(tags=["training"])


@router.post("/pipelines/{pipeline_id}/train")
def train_pipeline(
    pipeline_id: int,
    payload: TrainRequest,
    db: Session = Depends(get_db),
) -> EventSourceResponse:
    pipeline = db.get(Pipeline, pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipeline.dataset_id is None:
        raise HTTPException(status_code=422, detail="Pipeline must reference a dataset")
    dataset = db.get(Dataset, pipeline.dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    def event_stream():
        stream_db = SessionLocal()
        try:
            stream_pipeline = stream_db.get(Pipeline, pipeline_id)
            stream_dataset = stream_db.get(Dataset, pipeline.dataset_id)
            if stream_pipeline is None or stream_dataset is None:
                yield {"event": "error", "data": TrainingError(message="Pipeline or dataset is unavailable").model_dump_json()}
                return
            yield {"event": "started", "data": TrainingStarted(
                pipeline_id=stream_pipeline.id, dataset_id=stream_dataset.id, target_column=payload.target_column,
            ).model_dump_json()}
            yield from train_pipeline_events(stream_db, stream_pipeline, stream_dataset, payload.target_column)
        except Exception as exc:
            stream_db.rollback()
            yield {"event": "error", "data": TrainingError(message=str(exc)).model_dump_json()}
        finally:
            stream_db.close()

    return EventSourceResponse(event_stream())


@router.post("/models/{run_id}/predict", response_model=PredictionResponse)
def predict(run_id: int, payload: PredictionRequest, db: Session = Depends(get_db)) -> PredictionResponse:
    run = db.get(TrainingRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Training run not found")
    try:
        model = joblib.load(run.artifact_path)
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=404, detail="Model artifact is unavailable") from exc
    rows = [row.root for row in payload.rows]
    expected = set(str(name) for name in getattr(model, "feature_names_in_", []))
    if expected and any(set(row) != expected for row in rows):
        raise HTTPException(status_code=422, detail="Each row must include the model's feature columns")
    features = pd.DataFrame(rows)
    try:
        labels = model.predict(features)
        probabilities = model.predict_proba(features) if hasattr(model, "predict_proba") else None
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Prediction rows could not be processed") from exc
    classes = getattr(model, "classes_", [])
    predictions: list[Prediction] = []
    for index, raw_label in enumerate(labels):
        label = _scalar(raw_label)
        label = cast(str | int | float | bool, label)
        class_probabilities = []
        if probabilities is not None:
            class_probabilities = [
                ClassProbability(label=cast(str | int | float | bool, _scalar(class_label)), probability=float(probabilities[index][class_index]))
                for class_index, class_label in enumerate(classes)
            ]
        predictions.append(Prediction(label=label, probabilities=class_probabilities))
    return PredictionResponse(run_id=run.id, predictions=predictions)


def _scalar(value: object) -> str | int | float | bool:
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


@router.get("/models/{run_id}/export")
def export_model(run_id: int, db: Session = Depends(get_db)) -> FileResponse:
    run = db.get(TrainingRun, run_id)
    if run is None or not Path(run.artifact_path).is_file():
        raise HTTPException(status_code=404, detail="Model artifact not found")
    return FileResponse(run.artifact_path, filename=f"modelforge-model-{run.id}.joblib", media_type="application/octet-stream")
