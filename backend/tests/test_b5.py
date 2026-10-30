import pytest

from app.services.drafting import DraftingUnavailable, request_draft


def test_drafting_reports_missing_provider_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(DraftingUnavailable, match="OPENAI_API_KEY"):
        request_draft(context={"goal": "classify"})
