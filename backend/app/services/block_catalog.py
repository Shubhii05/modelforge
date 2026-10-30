from pydantic import BaseModel, ValidationError
from typing import get_args

from app.schemas.pipeline import (
    BlockCatalogEntry, BlockValidationResult, EncodingParams, LogisticRegressionParams,
    MissingValuesParams, OutliersParams, ParamField, ParamObject, RandomForestParams,
    ScalingParams, SplitParams, SVMParams, XGBoostParams,
)


PARAM_MODELS: dict[str, type[BaseModel]] = {
    "Missing Values": MissingValuesParams,
    "Scaling": ScalingParams,
    "Encoding": EncodingParams,
    "Outliers": OutliersParams,
    "Train/Test Split": SplitParams,
    "Random Forest": RandomForestParams,
    "XGBoost": XGBoostParams,
    "Logistic Regression": LogisticRegressionParams,
    "SVM": SVMParams,
}


DESCRIPTIONS = {
    "Missing Values": ("preprocessing", "Impute missing feature values."),
    "Scaling": ("preprocessing", "Scale numeric features."),
    "Encoding": ("preprocessing", "Encode categorical features."),
    "Outliers": ("preprocessing", "Detect or cap numeric outliers."),
    "Train/Test Split": ("data", "Configure the holdout split."),
    "Random Forest": ("model", "Train a random forest estimator."),
    "XGBoost": ("model", "Train an XGBoost estimator."),
    "Logistic Regression": ("model", "Train a logistic regression estimator."),
    "SVM": ("model", "Train a support vector machine."),
}


def _field_info(name: str, field: object) -> ParamField:
    required = bool(getattr(field, "is_required")())
    default_value = getattr(field, "default", None)
    annotation = getattr(field, "annotation", object)
    value_type = getattr(annotation, "__name__", str(annotation).replace("typing.", ""))
    choices: list[str] = []
    choices.extend(str(choice) for choice in get_args(annotation))
    metadata = getattr(field, "metadata", [])
    for item in metadata:
        choices.extend(str(choice) for choice in getattr(item, "choices", []))
    return ParamField(name=name, value_type=value_type, required=required,
                      default=None if default_value is ... else default_value,
                      choices=choices, description="Validated block parameter.")


def get_catalog() -> list[BlockCatalogEntry]:
    entries: list[BlockCatalogEntry] = []
    for block_type, model in PARAM_MODELS.items():
        category, description = DESCRIPTIONS[block_type]
        fields = [_field_info(name, field) for name, field in model.model_fields.items()]
        entries.append(BlockCatalogEntry(type=block_type, category=category, description=description, params=fields))
    return entries


def validate_block(block_type: str, params: ParamObject) -> BlockValidationResult:
    model = PARAM_MODELS.get(block_type)
    if model is None:
        raise KeyError(block_type)
    validated = model.model_validate(params.root)
    return BlockValidationResult(valid=True, type=block_type, params=ParamObject(validated.model_dump(exclude_none=True)))


def validate_pipeline_blocks(blocks: list[object]) -> list[dict[str, object]]:
    """Validate block parameters and return JSON-ready blocks for persistence."""
    stored: list[dict[str, object]] = []
    for block in blocks:
        block_type = getattr(block, "type")
        params = getattr(block, "params")
        try:
            checked = validate_block(block_type, params)
        except (KeyError, ValidationError) as exc:
            raise ValueError(f"Invalid parameters for block '{block_type}': {exc}") from exc
        stored.append({"id": getattr(block, "id"), "type": checked.type, "params": checked.params.root})
    return stored
