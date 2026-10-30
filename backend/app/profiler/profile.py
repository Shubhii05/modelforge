from pathlib import Path

import pandas as pd
from pandas.api.types import is_numeric_dtype

from app.schemas.dataset import ClassBalance, ColumnProfile, DatasetProfile


def profile_csv(path: Path, dataset_id: int) -> DatasetProfile:
    frame = pd.read_csv(path)
    columns: list[ColumnProfile] = []
    for name in frame.columns:
        series = frame[name]
        numeric = is_numeric_dtype(series)
        non_null = series.dropna()
        date_like = False
        if not numeric and len(non_null):
            parsed = pd.to_datetime(non_null, errors="coerce")
            date_like = float(parsed.notna().mean()) >= 0.8
        skew: float | None = None
        outlier_percent: float | None = None
        if numeric and len(non_null):
            skew_value = float(non_null.skew())
            skew = skew_value if pd.notna(skew_value) else 0.0
            q1, q3 = non_null.quantile([0.25, 0.75])
            spread = float(q3 - q1)
            if spread == 0:
                outlier_percent = 0.0
            else:
                outliers = (non_null < q1 - 1.5 * spread) | (non_null > q3 + 1.5 * spread)
                outlier_percent = float(outliers.mean() * 100)
        inferred = "numeric" if numeric else ("datetime" if date_like else ("categorical" if series.nunique(dropna=True) <= 50 else "text"))
        columns.append(ColumnProfile(
            name=str(name), inferred_type=inferred,
            missing_percent=float(series.isna().mean() * 100),
            cardinality=int(series.nunique(dropna=True)), skew=skew,
            outlier_percent=outlier_percent, date_like=date_like,
        ))
    balances: list[ClassBalance] = []
    for column in frame.columns:
        series = frame[column].dropna()
        unique = int(series.nunique())
        if 1 < unique <= 20:
            counts = series.astype(str).value_counts()
            minority = float(counts.min() / counts.sum() * 100)
            if minority < 25:
                balances.append(ClassBalance(column=str(column), counts={str(k): int(v) for k, v in counts.items()}, minority_percent=minority, imbalanced=True))
    return DatasetProfile(dataset_id=dataset_id, rows=len(frame), columns=len(frame.columns), column_profiles=columns, class_imbalance=balances)
