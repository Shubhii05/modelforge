from datetime import datetime

from pydantic import BaseModel, ConfigDict, RootModel

from app.schemas.pipeline import ParamObject


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    filename: str
    size_bytes: int
    created_at: datetime


class ColumnProfile(BaseModel):
    name: str
    inferred_type: str
    missing_percent: float
    cardinality: int
    skew: float | None
    outlier_percent: float | None
    date_like: bool


class ClassCounts(RootModel[dict[str, int]]):
    pass


class ClassBalance(BaseModel):
    column: str
    counts: ClassCounts
    minority_percent: float
    imbalanced: bool


class DatasetProfile(BaseModel):
    dataset_id: int
    rows: int
    columns: int
    column_profiles: list[ColumnProfile]
    class_imbalance: list[ClassBalance]


class SuggestedFix(BaseModel):
    type: str
    params: ParamObject


class SuggestionCard(BaseModel):
    id: str
    severity: str
    title: str
    text: str
    fix_block: SuggestedFix
