from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class ParamObject(RootModel[dict[str, str | int | float | bool | None]]):
    """A JSON object whose values are limited to scalar JSON parameter values."""


class PipelineBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=100)
    type: str = Field(min_length=1, max_length=80)
    params: ParamObject = Field(default_factory=lambda: ParamObject({}))


class PipelineCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    dataset_id: int | None = None
    blocks: list[PipelineBlock]


class PipelineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    dataset_id: int | None
    blocks: list[PipelineBlock]
    created_at: datetime
    updated_at: datetime


class ParamField(BaseModel):
    name: str
    value_type: str
    required: bool
    default: str | int | float | bool | None
    choices: list[str]
    description: str


class BlockCatalogEntry(BaseModel):
    type: str
    category: str
    description: str
    params: list[ParamField]


class BlockValidationRequest(BaseModel):
    type: str
    params: ParamObject


class BlockValidationResult(BaseModel):
    valid: bool
    type: str
    params: ParamObject


class MissingValuesParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    strategy: Literal["mean", "median", "most_frequent", "constant"] = "median"
    column: str | None = None
    fill_value: str | int | float | None = None


class ScalingParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    method: Literal["standard", "minmax", "robust"] = "standard"


class EncodingParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    method: Literal["onehot", "ordinal"] = "onehot"


class OutliersParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    method: Literal["iqr", "zscore"] = "iqr"
    threshold: float = Field(default=1.5, gt=0)
    column: str | None = None


class SplitParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    test_size: float = Field(default=0.2, gt=0, lt=1)
    random_state: int = 42
    stratify: str | None = None


class RandomForestParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    n_estimators: int = Field(default=100, ge=1, le=2000)
    max_depth: int | None = Field(default=None, ge=1, le=1000)
    random_state: int = 42


class XGBoostParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    n_estimators: int = Field(default=100, ge=1, le=2000)
    max_depth: int = Field(default=6, ge=1, le=50)
    learning_rate: float = Field(default=0.1, gt=0, le=1)
    random_state: int = 42


class LogisticRegressionParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    C: float = Field(default=1.0, gt=0)
    max_iter: int = Field(default=1000, ge=1, le=100000)
    random_state: int = 42


class SVMParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    C: float = Field(default=1.0, gt=0)
    kernel: Literal["linear", "rbf", "poly", "sigmoid"] = "rbf"


