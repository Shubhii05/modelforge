from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, RootModel


class TrainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_column: str = Field(min_length=1, max_length=255)


class TrainingMetric(BaseModel):
    iteration: int
    accuracy: float
    loss: float
    confusion_matrix: list[list[int]]
    precision: float
    f1: float


class TrainingComplete(BaseModel):
    run_id: int
    accuracy: float


class TrainingStarted(BaseModel):
    pipeline_id: int
    dataset_id: int
    target_column: str


class TrainingError(BaseModel):
    message: str


class FeatureRow(RootModel[dict[str, str | int | float | bool | None]]):
    pass


class PredictionRequest(BaseModel):
    rows: list[FeatureRow] = Field(min_length=1)


class ClassProbability(BaseModel):
    label: str | int | float | bool
    probability: float


class Prediction(BaseModel):
    label: str | int | float | bool
    probabilities: list[ClassProbability]


class PredictionResponse(BaseModel):
    run_id: int
    predictions: list[Prediction]


class TrainingRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pipeline_id: int | None
    dataset_id: int
    target_column: str
    accuracy: float
    created_at: datetime
