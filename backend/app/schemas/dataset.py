from datetime import datetime

from pydantic import BaseModel, ConfigDict


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


class ClassBalance(BaseModel):
    column: str
    counts: dict[str, int]
    minority_percent: float
    imbalanced: bool


class DatasetProfile(BaseModel):
    dataset_id: int
    rows: int
    columns: int
    column_profiles: list[ColumnProfile]
    class_imbalance: list[ClassBalance]


class SuggestionCard(BaseModel):
    id: str
    severity: str
    title: str
    text: str
    fix_block: dict[str, object]
