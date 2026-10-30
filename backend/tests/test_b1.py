from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.datasets import upload_dataset
from app.core.config import MAX_DATASET_BYTES

def test_profile_and_suggestions() -> None:
    from app.api import datasets
    local_data = Path(__file__).parent / ".test-data"
    local_data.mkdir(exist_ok=True)
    payload = b"age,group,label\n1,a,yes\n2,a,yes\n100,b,yes\n, b,no\n4,a,yes\n"
    csv_path = local_data / "issues.csv"
    csv_path.write_bytes(payload)
    result = datasets.profile_csv(csv_path, 1)
    assert result.rows == 5
    assert next(c for c in result.column_profiles if c.name == "age").missing_percent == 20
    assert result.class_imbalance
    cards = datasets.suggestions_for(result)
    assert cards and all(card.fix_block for card in cards)
    csv_path.unlink(missing_ok=True)


def test_upload_rejects_non_csv_and_oversized_payloads() -> None:
    class Request:
        def __init__(self, payload):
            self.payload = payload

        async def body(self):
            return self.payload

    class OversizedPayload:
        def __len__(self):
            return MAX_DATASET_BYTES + 1

    class DB:
        def scalar(self, *_args):
            return None

    def send(coroutine):
        try:
            return coroutine.send(None)
        except StopIteration as result:
            return result.value

    def check() -> None:
        with pytest.raises(HTTPException) as invalid:
            send(upload_dataset(Request(b"a,b\n1,2\n"), "data.txt", DB()))
        assert invalid.value.status_code == 400
        with pytest.raises(HTTPException) as large:
            send(upload_dataset(Request(OversizedPayload()), "large.csv", DB()))
        assert large.value.status_code == 413

    check()


