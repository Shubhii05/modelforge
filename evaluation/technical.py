from __future__ import annotations

import csv
import argparse
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.profiler.profile import profile_csv  # noqa: E402
from app.services.drafting import default_draft, request_draft  # noqa: E402


def seeded_csv(path: Path) -> None:
    fields = ["missing", "outliers", "skew", "label", "date", "high_cardinality", "control"]
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        start_date = date(2025, 1, 1)
        for index in range(100):
            writer.writerow({
                "missing": "" if index < 10 else index,
                "outliers": 10000 if index >= 90 else index,
                "skew": 1000 if index == 99 else 1,
                "label": "minority" if index < 2 else "majority",
                "date": (start_date + timedelta(days=index)).isoformat(),
                "high_cardinality": f"item-{index}",
                "control": 0,
            })


def evaluate_profiler(path: Path) -> None:
    profile = profile_csv(path, 0)
    by_name = {column.name: column for column in profile.column_profiles}
    truth = {"missing", "outliers", "skew", "imbalance", "date_like", "cardinality"}
    detected = {
        "missing": by_name["missing"].missing_percent > 0,
        "outliers": (by_name["outliers"].outlier_percent or 0) >= 5,
        "skew": abs(by_name["skew"].skew or 0) > 1.5,
        "imbalance": any(balance.column == "label" for balance in profile.class_imbalance),
        "date_like": by_name["date"].date_like,
        "cardinality": by_name["high_cardinality"].cardinality > 50,
    }
    control_column = by_name["control"]
    control_flags = {
        "missing": control_column.missing_percent > 0,
        "outliers": (control_column.outlier_percent or 0) >= 5,
        "skew": abs(control_column.skew or 0) > 1.5,
        "imbalance": any(balance.column == "control" for balance in profile.class_imbalance),
        "date_like": control_column.date_like,
        "cardinality": control_column.cardinality > 50,
    }
    for issue in sorted(truth):
        print(f"Profiler {issue}: expected=True detected={detected[issue]} control_false_alarm={control_flags[issue]}")
    true_positive = sum(detected[issue] for issue in truth)
    false_positive = sum(control_flags.values())
    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 1.0
    recall = true_positive / len(truth) if truth else 1.0
    print(f"Profiler precision={precision:.3f} recall={recall:.3f} TP={true_positive} FP={false_positive} FN={len(truth) - true_positive}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, help="Seeded CSV with missing, outliers, skew, label, date, and high_cardinality columns")
    args = parser.parse_args()
    if args.dataset:
        evaluate_profiler(args.dataset)
    else:
        seeded_path = ROOT / "datasets" / "seeded_issues.csv"
        if seeded_path.is_file():
            evaluate_profiler(seeded_path)
        else:
            with tempfile.TemporaryDirectory(prefix=".modelforge-evaluation-", dir=ROOT) as directory:
                path = Path(directory) / "seeded_issues.csv"
                seeded_csv(path)
                evaluate_profiler(path)

    defaults = default_draft()
    proposal = request_draft(context={"goal": "binary classification", "target_column": "label"}) if os.getenv("OPENAI_API_KEY") else defaults
    source = "provider/fallback" if os.getenv("OPENAI_API_KEY") and proposal != defaults else "defaults"
    print(f"LLM-vs-defaults source={source} same_blocks={proposal.get('blocks') == defaults.get('blocks')} default_blocks={len(defaults['blocks'])} proposal_blocks={len(proposal.get('blocks', []))}")


if __name__ == "__main__":
    main()
