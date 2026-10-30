from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.datasets import get_db
from app.codegen.renderer import render_pipeline_code
from app.models.dataset import Dataset
from app.models.pipeline import Pipeline
from app.schemas.codegen import CodeGenerationRequest, GeneratedCode
from app.schemas.pipeline import PipelineBlock

router = APIRouter(tags=["code generation"])


@router.post("/pipelines/{pipeline_id}/code", response_model=GeneratedCode)
def generate_pipeline_code(
    pipeline_id: int,
    payload: CodeGenerationRequest,
    db: Session = Depends(get_db),
) -> GeneratedCode:
    pipeline = db.get(Pipeline, pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipeline.dataset_id is None:
        raise HTTPException(status_code=422, detail="Pipeline must reference a dataset")
    dataset = db.get(Dataset, pipeline.dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        frame = pd.read_csv(Path(dataset.path), nrows=1)
    except (OSError, pd.errors.ParserError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=422, detail="Dataset could not be loaded") from exc
    if payload.target_column not in frame.columns:
        raise HTTPException(status_code=422, detail="Target column is not present in the dataset")
    try:
        blocks = [PipelineBlock.model_validate(block) for block in pipeline.blocks]
        code = render_pipeline_code(dataset_filename=dataset.filename, target_column=payload.target_column, blocks=blocks)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return GeneratedCode(pipeline_id=pipeline.id, filename=dataset.filename, target_column=payload.target_column, code=code)
