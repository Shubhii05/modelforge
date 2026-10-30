from pydantic import BaseModel, ConfigDict, Field

from app.schemas.pipeline import ParamObject


class DraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_column: str = Field(min_length=1, max_length=255)
    goal: str = Field(default="Build a suitable predictive model", max_length=2000)


class DraftBlock(BaseModel):
    type: str
    params: ParamObject
    rationale: str = Field(max_length=1000)


class DraftResponse(BaseModel):
    pipeline_id: int
    target_column: str
    blocks: list[DraftBlock]
    custom_code: str
    rationale: str
