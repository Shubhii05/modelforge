import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from urllib.error import HTTPError

from app.api.drafting import draft_pipeline, validate_code
from app.services import drafting
from app.models.dataset import Dataset
from app.models.pipeline import Pipeline
from app.schemas.drafting import CustomCodeValidationRequest, DraftRequest


def test_drafting_uses_default_when_provider_key_is_missing(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    proposal = drafting.request_draft(context={"goal": "classify"})
    assert proposal["custom_code"] == ""
    assert [block["type"] for block in proposal["blocks"]] == ["Train/Test Split", "Random Forest"]


def test_drafting_uses_default_when_provider_returns_bad_json(monkeypatch) -> None:
    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return b'{"choices":[{"message":{"content":"not-json"}}]}'

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(drafting, "urlopen", lambda *_args, **_kwargs: Response())
    proposal = drafting.request_draft(context={"goal": "classify"})
    assert proposal["custom_code"] == ""
    assert proposal["rationale"].startswith("LLM unavailable")


def test_drafting_uses_default_when_provider_rejects_key(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "invalid-test-key")
    monkeypatch.setattr(drafting, "urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(HTTPError("https://provider.test", 401, "unauthorized", {}, None)))
    proposal = drafting.request_draft(context={"goal": "classify"})
    assert proposal["blocks"] == drafting.default_draft()["blocks"]


@pytest.mark.parametrize("code", [
    "import os", "import subprocess", "import socket", "open('secret')", "__import__('os')",
    "eval('1 + 1')", "exec('pass')",
])
def test_custom_code_sandbox_rejects_dangerous_operations(code: str) -> None:
    with pytest.raises(ValueError):
        drafting.validate_custom_code(code)


def test_custom_code_sandbox_allows_sklearn_transformer_imports() -> None:
    drafting.validate_custom_code("from sklearn.base import BaseEstimator, TransformerMixin")


def test_custom_code_validation_route_rejects_file_access() -> None:
    with pytest.raises(HTTPException) as error:
        validate_code(CustomCodeValidationRequest(code="open('secret.txt')"))
    assert error.value.status_code == 422


def test_draft_endpoint_falls_back_when_key_is_missing(monkeypatch) -> None:
    path = Path(__file__).parent / f".draft-fallback-{uuid.uuid4().hex}.csv"
    path.write_text("feature,label\n1,no\n2,yes\n", encoding="utf-8")
    dataset = Dataset(id=3, name="sample", filename=path.name, path=str(path), size_bytes=path.stat().st_size)
    pipeline = Pipeline(id=4, name="sample", dataset_id=3, blocks=[])

    class DB:
        def get(self, model, _id):
            return pipeline if model is Pipeline else dataset

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    try:
        response = draft_pipeline(4, DraftRequest(target_column="label"), DB())
        assert [block.type for block in response.blocks] == ["Train/Test Split", "Random Forest"]
        assert response.custom_code == ""
    finally:
        path.unlink(missing_ok=True)


def test_draft_endpoint_falls_back_when_provider_returns_bad_json(monkeypatch) -> None:
    path = Path(__file__).parent / f".draft-invalid-json-{uuid.uuid4().hex}.csv"
    path.write_text("feature,label\n1,no\n2,yes\n", encoding="utf-8")
    dataset = Dataset(id=5, name="sample", filename=path.name, path=str(path), size_bytes=path.stat().st_size)
    pipeline = Pipeline(id=6, name="sample", dataset_id=5, blocks=[])

    class DB:
        def get(self, model, _id):
            return pipeline if model is Pipeline else dataset

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return b'{"choices":[{"message":{"content":"not-json"}}]}'

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(drafting, "urlopen", lambda *_args, **_kwargs: Response())
    try:
        response = draft_pipeline(6, DraftRequest(target_column="label"), DB())
        assert [block.type for block in response.blocks] == ["Train/Test Split", "Random Forest"]
        assert response.custom_code == ""
    finally:
        path.unlink(missing_ok=True)
