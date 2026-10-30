from pathlib import Path

from app.codegen.renderer import render_pipeline_code
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
