from pathlib import Path


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


