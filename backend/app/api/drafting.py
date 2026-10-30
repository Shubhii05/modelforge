from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.datasets import get_db
from app.models.dataset import Dataset
from app.models.pipeline import Pipeline
from app.profiler.profile import profile_csv
from app.schemas.drafting import CustomCodeValidationRequest, DraftBlock, DraftRequest, DraftResponse
from app.schemas.pipeline import ParamObject
from app.services.block_catalog import get_catalog, validate_block
from app.services.drafting import request_draft, validate_custom_code

router = APIRouter(tags=["LLM drafting"])


@router.post("/custom-code/validate")
def validate_code(payload: CustomCodeValidationRequest) -> dict[str, bool]:
    try:
        validate_custom_code(payload.code)
    except (SyntaxError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Custom code contains invalid or blocked operations") from exc
    return {"valid": True}


@router.post("/pipelines/{pipeline_id}/draft", response_model=DraftResponse)
def draft_pipeline(pipeline_id: int, payload: DraftRequest, db: Session = Depends(get_db)) -> DraftResponse:
    pipeline = db.get(Pipeline, pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipeline.dataset_id is None:
        raise HTTPException(status_code=422, detail="Pipeline must reference a dataset")
    dataset = db.get(Dataset, pipeline.dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        profile = profile_csv(Path(dataset.path), dataset.id)
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Dataset could not be profiled") from exc
    if payload.target_column not in {column.name for column in profile.column_profiles}:
        raise HTTPException(status_code=422, detail="Target column is not present in the dataset")
    proposal = request_draft(context={"goal": payload.goal, "target_column": payload.target_column,
                                      "dataset_profile": profile.model_dump(), "allowed_blocks": [entry.model_dump() for entry in get_catalog()]})
    try:
        blocks: list[DraftBlock] = []
        for item in proposal["blocks"]:
            checked = validate_block(item["type"], ParamObject(item.get("params", {})))
            blocks.append(DraftBlock(type=checked.type, params=checked.params, rationale=item.get("rationale", "")))
        custom_code = proposal.get("custom_code", "")
        rationale = proposal.get("rationale", "")
        if not isinstance(custom_code, str) or len(custom_code) > 20000 or not isinstance(rationale, str):
            raise ValueError("Invalid proposal fields")
        if custom_code:
            validate_custom_code(custom_code)
        return DraftResponse(pipeline_id=pipeline.id, target_column=payload.target_column,
                             blocks=blocks, custom_code=custom_code, rationale=rationale)
    except (KeyError, TypeError, ValueError, SyntaxError) as exc:
        raise HTTPException(status_code=502, detail="LLM provider returned an invalid proposal") from exc
