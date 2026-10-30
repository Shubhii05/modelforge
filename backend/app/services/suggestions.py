from app.schemas.dataset import DatasetProfile, SuggestionCard


def suggestions_for(profile: DatasetProfile) -> list[SuggestionCard]:
    cards: list[SuggestionCard] = []

    # 1. Missing values per column
    for column in profile.column_profiles:
        if column.missing_percent > 0:
            strategy = "median" if column.inferred_type == "numeric" else "most_frequent"
            cards.append(
                SuggestionCard(
                    id=f"missing-{column.name}",
                    severity="warning",
                    title=f"Missing values in {column.name}",
                    text=f"{column.missing_percent:.1f}% of values are missing. Impute using {strategy} strategy before fitting models.",
                    fix_block={"type": "Missing Values", "params": {"strategy": strategy, "column": column.name}},
                )
            )

    # 2. Categorical features needing encoding
    categorical_cols = [c.name for c in profile.column_profiles if c.inferred_type == "categorical"]
    if categorical_cols:
        sample_names = ", ".join(categorical_cols[:3])
        if len(categorical_cols) > 3:
            sample_names += f" and {len(categorical_cols) - 3} more"
        cards.append(
            SuggestionCard(
                id="categorical-encoding",
                severity="info",
                title=f"Encode categorical features ({sample_names})",
                text=f"Found {len(categorical_cols)} categorical column(s). Apply One-Hot Encoding so linear and tree models can process categories.",
                fix_block={"type": "Encoding", "params": {"method": "onehot"}},
            )
        )

    # 3. Outliers in numeric columns
    for column in profile.column_profiles:
        if column.outlier_percent is not None and column.outlier_percent >= 5:
            cards.append(
                SuggestionCard(
                    id=f"outliers-{column.name}",
                    severity="info",
                    title=f"Potential outliers in {column.name}",
                    text=f"{column.outlier_percent:.1f}% of values lie outside the 1.5x IQR boundary. Robust scaling or clipping prevents distortion.",
                    fix_block={"type": "Outliers", "params": {"method": "iqr", "column": column.name}},
                )
            )

    # 4. Severe skewness in numeric features
    for column in profile.column_profiles:
        if column.skew is not None and abs(column.skew) > 1.8:
            cards.append(
                SuggestionCard(
                    id=f"skew-{column.name}",
                    severity="info",
                    title=f"High skewness in {column.name} ({column.skew:.2f})",
                    text=f"Distribution for '{column.name}' is heavily skewed. Robust scaling or power transformation helps linear and distance-based estimators.",
                    fix_block={"type": "Scaling", "params": {"method": "robust"}},
                )
            )

    # 5. Class imbalance in target
    for balance in profile.class_imbalance:
        cards.append(
            SuggestionCard(
                id=f"balance-{balance.column}",
                severity="warning",
                title=f"Class imbalance in target '{balance.column}'",
                text=f"Minority class represents {balance.minority_percent:.1f}% of samples. Use stratified train/test split to preserve class ratios.",
                fix_block={"type": "Train/Test Split", "params": {"stratify": balance.column}},
            )
        )

    return cards
