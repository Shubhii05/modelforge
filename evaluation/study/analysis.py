import csv
import sys
from collections import defaultdict
from pathlib import Path


def main(path: str) -> None:
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    with Path(path).open(newline="", encoding="utf-8") as stream:
        for row in csv.DictReader(stream):
            groups[row["condition"].strip().lower()].append(row)
    for condition, rows in sorted(groups.items()):
        completion = sum(row["task_completed"].strip().lower() in {"1", "yes", "true"} for row in rows) / len(rows)
        times = [float(row["completion_minutes"]) for row in rows if row.get("completion_minutes")]
        confidence = [float(row["confidence_1_5"]) for row in rows if row.get("confidence_1_5")]
        mean_time = sum(times) / len(times) if times else 0.0
        mean_confidence = sum(confidence) / len(confidence) if confidence else 0.0
        print(f"{condition}: n={len(rows)} completion_rate={completion:.3f} mean_minutes={mean_time:.2f} mean_confidence={mean_confidence:.2f}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python evaluation/study/analysis.py responses.csv")
    main(sys.argv[1])
