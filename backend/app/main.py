from fastapi import FastAPI

from app.api.datasets import router as datasets_router
from app.core.database import Base, engine
from app.models import Dataset  # noqa: F401

Base.metadata.create_all(bind=engine)
app = FastAPI(title="ModelForge API", version="0.1.0")
app.include_router(datasets_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
