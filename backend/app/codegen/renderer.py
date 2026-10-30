import re
from collections.abc import Sequence

from app.codegen.lookup import BlockDefinition, definition_for
from app.schemas.pipeline import PipelineBlock
from app.services.block_catalog import validate_block


def _identifier(value: str) -> str:
    safe = re.sub(r"\W+", "_", value).strip("_").lower()
    return safe or "step"


def _literal(value: object) -> str:
    return repr(value)


def _constructor(definition: BlockDefinition, params: dict[str, str | int | float | bool | None]) -> str:
    args: list[str] = []
    for allowed in definition.constructor_params:
        if isinstance(allowed, tuple):
            name, value = allowed
            args.append(f"{name}={_literal(value)}")
        elif allowed in params and params[allowed] is not None:
            args.append(f"{allowed}={_literal(params[allowed])}")
    return f"{definition.class_name}({', '.join(args)})"


def _render_generic_steps(blocks: Sequence[PipelineBlock]) -> tuple[list[str], list[str]]:
    imports = {"from sklearn.pipeline import Pipeline"}
    steps: list[str] = []
    model_count = 0
    seen_names: dict[str, int] = {}
    model_seen = False
    for block in blocks:
        if block.type == "Train/Test Split":
            continue
        if model_seen:
            raise ValueError("Model block must follow all preprocessing blocks")
        params = validate_block(block.type, block.params).params.root
        definition = definition_for(block.type, params)
        imports.add(f"from {definition.import_path} import {definition.class_name}")
        if block.type in {"Random Forest", "XGBoost", "Logistic Regression", "SVM"}:
            model_count += 1
            model_seen = True
        step_name = _identifier(block.id)
        seen_names[step_name] = seen_names.get(step_name, 0) + 1
        if seen_names[step_name] > 1:
            step_name = f"{step_name}_{seen_names[step_name]}"
        steps.append(f"    ({step_name!r}, {_constructor(definition, params)}),")
    if model_count != 1:
        raise ValueError("Pipeline code generation requires exactly one model block")
    return sorted(imports), steps


def render_pipeline_code(
    *,
    dataset_filename: str,
    target_column: str,
    blocks: Sequence[PipelineBlock],
) -> str:
    split_block = next((block for block in blocks if block.type == "Train/Test Split"), None)
    split_params = validate_block("Train/Test Split", split_block.params).params.root if split_block else {"test_size": 0.2, "random_state": 42, "stratify": None}
    imports, steps = _render_generic_steps(blocks)
    imports.extend([
        "import pandas as pd",
        "from sklearn.model_selection import train_test_split",
    ])
    header = "\n".join(["# Generated from the ModelForge pipeline spec.", *sorted(set(imports)), ""])
    # Dataset loading, splitting, and training are the only handwritten templates.
    data_template = (
        f"df = pd.read_csv({('datasets/' + dataset_filename)!r})\n"
        f"target_column = {target_column!r}\n"
        "X = df.drop(columns=[target_column])\n"
        "y = df[target_column]\n"
    )
    stratify_expr = "y" if split_params.get("stratify") else "None"
    split_template = (
        "X_train, X_test, y_train, y_test = train_test_split(\n"
        "    X, y,\n"
        f"    test_size={_literal(split_params.get('test_size', 0.2))},\n"
        f"    random_state={_literal(split_params.get('random_state', 42))},\n"
        f"    stratify={stratify_expr},\n"
        ")\n\n"
    )
    pipeline_template = "pipeline = Pipeline(steps=[\n" + "\n".join(steps) + "\n])\n"
    train_template = (
        "pipeline.fit(X_train, y_train)\n"
        "accuracy = pipeline.score(X_test, y_test)\n"
        "print(f\"Test accuracy: {accuracy:.4f}\")\n"
    )
    return header + data_template + split_template + pipeline_template + "\n" + train_template
