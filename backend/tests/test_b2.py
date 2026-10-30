from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.pipelines import create_pipeline, delete_pipeline, get_pipeline, update_pipeline
from app.core.database import Base
from app.main import app
from app.schemas.pipeline import PipelineCreate, ParamObject
from app.services.block_catalog import get_catalog, validate_block


def _session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()


def test_catalog_and_parameter_validation() -> None:
    catalog = get_catalog()
    assert {item.type for item in catalog} >= {"Missing Values", "Random Forest", "SVM"}
    valid = validate_block("Random Forest", ParamObject({"n_estimators": 25}))
    assert valid.params.root["random_state"] == 42
    try:
        validate_block("Random Forest", ParamObject({"n_estimators": 0}))
    except ValueError:
        pass
    else:
        raise AssertionError("out-of-range parameter was accepted")
    assert "/api/blocks" in app.openapi()["paths"]


def test_pipeline_crud_and_validation() -> None:
    db = _session()
    payload = PipelineCreate.model_validate({"name": "Baseline", "blocks": [{"id": "b1", "type": "Scaling", "params": {"method": "standard"}}]})
    created = create_pipeline(payload, db)
    assert get_pipeline(created.id, db).name == "Baseline"
    updated_payload = payload.model_copy(update={"name": "Updated"})
    assert update_pipeline(created.id, updated_payload, db).name == "Updated"
    invalid_payload = PipelineCreate.model_validate({"name": "Bad", "blocks": [{"id": "bad", "type": "Scaling", "params": {"method": "unknown"}}]})
    try:
        update_pipeline(created.id, invalid_payload, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 422
    else:
        raise AssertionError("invalid block parameters were accepted")
    delete_pipeline(created.id, db)
    try:
        get_pipeline(created.id, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("deleted pipeline was still retrievable")
    db.close()
