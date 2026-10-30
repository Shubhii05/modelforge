from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.datasets import get_db
from app.models.dataset import Dataset
from app.models.pipeline import Pipeline
from app.schemas.pipeline import BlockCatalogEntry, BlockValidationRequest, BlockValidationResult, PipelineCreate, PipelineOut
from app.services.block_catalog import get_catalog, validate_block, validate_pipeline_blocks

router = APIRouter(tags=["pipelines"])


@router.get("/blocks", response_model=list[BlockCatalogEntry])
def list_blocks() -> list[BlockCatalogEntry]:
    return get_catalog()


@router.post("/blocks/validate", response_model=BlockValidationResult)
def check_block(payload: BlockValidationRequest) -> BlockValidationResult:
    try:
        return validate_block(payload.type, payload.params)
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=f"Unknown block type: {payload.type}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _prepare(payload: PipelineCreate, db: Session) -> list[dict[str, object]]:
    if payload.dataset_id is not None and db.get(Dataset, payload.dataset_id) is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        return validate_pipeline_blocks(payload.blocks)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/pipelines", response_model=PipelineOut, status_code=201)
def create_pipeline(payload: PipelineCreate, db: Session = Depends(get_db)) -> Pipeline:
    pipeline = Pipeline(name=payload.name, dataset_id=payload.dataset_id, blocks=_prepare(payload, db))
    db.add(pipeline)
    db.commit()
    db.refresh(pipeline)
    return pipeline


@router.get("/pipelines", response_model=list[PipelineOut])
def list_pipelines(db: Session = Depends(get_db)) -> list[Pipeline]:
    return list(db.scalars(select(Pipeline).order_by(Pipeline.updated_at.desc())))


@router.get("/pipelines/{pipeline_id}", response_model=PipelineOut)
def get_pipeline(pipeline_id: int, db: Session = Depends(get_db)) -> Pipeline:
    pipeline = db.get(Pipeline, pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.put("/pipelines/{pipeline_id}", response_model=PipelineOut)
def update_pipeline(pipeline_id: int, payload: PipelineCreate, db: Session = Depends(get_db)) -> Pipeline:
    pipeline = db.get(Pipeline, pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pipeline.name = payload.name
    pipeline.dataset_id = payload.dataset_id
    pipeline.blocks = _prepare(payload, db)
    db.commit()
    db.refresh(pipeline)
    return pipeline


@router.delete("/pipelines/{pipeline_id}", status_code=204)
def delete_pipeline(pipeline_id: int, db: Session = Depends(get_db)) -> Response:
    pipeline = db.get(Pipeline, pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    db.delete(pipeline)
    db.commit()
    return Response(status_code=204)
