import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.codegen import generate_pipeline_code
from app.core.config import DATASET_DIR, ROOT_DIR
from app.codegen.renderer import render_pipeline_code
from app.core.database import Base
from app.models.dataset import Dataset
from app.models.pipeline import Pipeline
from app.schemas.codegen import CodeGenerationRequest
from app.schemas.pipeline import PipelineBlock


def test_generated_code_matches_snapshot() -> None:
    blocks = [
        PipelineBlock(id="imputer", type="Missing Values", params={"strategy": "median"}),
        PipelineBlock(id="scaler", type="Scaling", params={"method": "standard"}),
        PipelineBlock(id="split", type="Train/Test Split", params={"test_size": 0.25, "random_state": 7, "stratify": "label"}),
        PipelineBlock(id="forest", type="Random Forest", params={"n_estimators": 25, "random_state": 7}),
    ]
    code = render_pipeline_code(dataset_filename="sample.csv", target_column="label", blocks=blocks)
    snapshot = Path(__file__).parent / "snapshots" / "generated_pipeline.py.txt"
    assert code == snapshot.read_text(encoding="utf-8")
    assert "Pipeline(steps=[" in code
    assert "pipeline.fit(X_train, y_train)" in code


def test_generator_requires_exactly_one_model() -> None:
    blocks = [PipelineBlock(id="scale", type="Scaling", params={})]
    try:
        render_pipeline_code(dataset_filename="sample.csv", target_column="label", blocks=blocks)
    except ValueError as exc:
        assert "exactly one model" in str(exc)
    else:
        raise AssertionError("pipeline without a model was rendered")


def test_saved_generated_pipeline_executes_against_dataset_csv() -> None:
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"qa-{uuid.uuid4().hex}.csv"
    csv_path = DATASET_DIR / filename
    csv_path.write_text("feature,label\n" + "\n".join(f"{value},{'yes' if value % 2 else 'no'}" for value in range(1, 61)), encoding="utf-8")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        dataset = Dataset(name="qa", filename=filename, path=str(csv_path), size_bytes=csv_path.stat().st_size)
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        pipeline = Pipeline(name="QA generated code", dataset_id=dataset.id, blocks=[
            {"id": "split", "type": "Train/Test Split", "params": {"test_size": 0.2, "random_state": 42}},
            {"id": "forest", "type": "Random Forest", "params": {"n_estimators": 5, "random_state": 42}},
        ])
        db.add(pipeline)
        db.commit()
        db.refresh(pipeline)
        generated = generate_pipeline_code(pipeline.id, CodeGenerationRequest(target_column="label"), db)
        with tempfile.TemporaryDirectory(prefix="modelforge-codegen-qa-", dir=ROOT_DIR) as temp_dir:
            script = Path(temp_dir) / "generated_pipeline.py"
            script.write_text(generated.code, encoding="utf-8")
            result = subprocess.run([sys.executable, str(script)], cwd=ROOT_DIR, check=True, capture_output=True, text=True)
            assert "Test accuracy:" in result.stdout
    finally:
        db.close()
        engine.dispose()
        csv_path.unlink(missing_ok=True)
