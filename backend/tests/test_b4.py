from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.training import predict
from app.core.database import Base
from app.models.dataset import Dataset
from app.models.pipeline import Pipeline
from app.models.training_run import TrainingRun
from app.schemas.training import PredictionRequest
from app.services import training


def test_train_stream_predict_and_export(monkeypatch) -> None:
    work_dir = Path(__file__).parent / ".test-training"
    work_dir.mkdir(exist_ok=True)
    csv_path = work_dir / "training.csv"
    rows = ["feature,label"] + [f"{value},{'yes' if value % 2 else 'no'}" for value in range(1, 41)]
    rows[2] = ",no"
    csv_path.write_text("\n".join(rows), encoding="utf-8")
    artifact_dir = work_dir / "artifacts"
    monkeypatch.setattr(training, "ARTIFACT_DIR", artifact_dir)

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    dataset = Dataset(name="training", filename="training.csv", path=str(csv_path), size_bytes=csv_path.stat().st_size)
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    pipeline = Pipeline(name="training", dataset_id=dataset.id, blocks=[
        {"id": "imputer", "type": "Missing Values", "params": {"strategy": "median"}},
        {"id": "scaler", "type": "Scaling", "params": {"method": "standard"}},
        {"id": "forest", "type": "Random Forest", "params": {"n_estimators": 10, "random_state": 42}},
    ])
    db.add(pipeline)
    db.commit()
    db.refresh(pipeline)

    events = list(training.train_pipeline_events(db, pipeline, dataset, "label"))
    metric_events = [event for event in events if event["event"] == "metric"]
    assert len(metric_events) == 10
    assert "confusion_matrix" in metric_events[-1]["data"]
    run = db.query(TrainingRun).one()
    assert Path(run.artifact_path).is_file()
    predictions = predict(run.id, PredictionRequest.model_validate({"rows": [{"feature": 5}]}), db)
    assert len(predictions.predictions) == 1
    assert predictions.predictions[0].probabilities

    Path(run.artifact_path).unlink()
    csv_path.unlink()
    db.close()
