import json
from pathlib import Path

import joblib
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline as SklearnPipeline
from sklearn.preprocessing import StandardScaler

from app.api.training import export_model, predict
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
    final_metric = json.loads(metric_events[-1]["data"])
    assert {"accuracy", "loss", "confusion_matrix", "precision", "f1"} <= final_metric.keys()

    frame = pd.read_csv(csv_path).dropna(subset=["label"])
    X_train, X_test, y_train, y_test = train_test_split(frame.drop(columns=["label"]), frame["label"], test_size=0.2, random_state=42)
    independent = SklearnPipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", RandomForestClassifier(n_estimators=10, random_state=42, n_jobs=1)),
    ]).fit(X_train, y_train)
    assert final_metric["accuracy"] == accuracy_score(y_test, independent.predict(X_test))

    run = db.query(TrainingRun).one()
    assert Path(run.artifact_path).is_file()
    exported = export_model(run.id, db)
    loaded_model = joblib.load(exported.path)
    assert loaded_model.predict(pd.DataFrame([{"feature": 5}])).shape == (1,)
    predictions = predict(run.id, PredictionRequest.model_validate({"rows": [{"feature": 5}]}), db)
    assert len(predictions.predictions) == 1
    assert predictions.predictions[0].probabilities

    Path(run.artifact_path).unlink()
    csv_path.unlink()
    db.close()
