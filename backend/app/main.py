from fastapi import FastAPI
from pydantic import BaseModel

from app.api.datasets import router as datasets_router
from app.api.pipelines import router as pipelines_router
from app.core.database import Base, engine
from app.models import Dataset, Pipeline  # noqa: F401

Base.metadata.create_all(bind=engine)
app = FastAPI(title="ModelForge API", version="0.1.0")
app.include_router(datasets_router, prefix="/api")
app.include_router(pipelines_router, prefix="/api")


class HealthResponse(BaseModel):
    status: str


@app.get("/health")
def health() -> HealthResponse:
    return HealthResponse(status="ok")
