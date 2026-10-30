from pydantic import BaseModel, ConfigDict, Field


class CodeGenerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_column: str = Field(min_length=1, max_length=255)


class GeneratedCode(BaseModel):
    pipeline_id: int
    filename: str
    target_column: str
    code: str
