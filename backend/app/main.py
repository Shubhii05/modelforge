import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.datasets import router as datasets_router
from app.api.codegen import router as codegen_router
from app.api.pipelines import router as pipelines_router
from app.api.training import router as training_router
from app.api.drafting import router as drafting_router
from app.api.usecase import router as usecase_router
from app.api.assistant import router as assistant_router
from app.core.database import Base, engine
from app.models import Dataset, Pipeline  # noqa: F401

Base.metadata.create_all(bind=engine)
app = FastAPI(title="ModelForge API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","), allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
app.include_router(datasets_router, prefix="/api")
app.include_router(pipelines_router, prefix="/api")
app.include_router(codegen_router, prefix="/api")
app.include_router(training_router, prefix="/api")
app.include_router(drafting_router, prefix="/api")
app.include_router(usecase_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")


class HealthResponse(BaseModel):
    status: str


@app.get("/health")
def health() -> HealthResponse:
    return HealthResponse(status="ok")
