from app.schemas.dataset import DatasetProfile, SuggestionCard


def suggestions_for(profile: DatasetProfile) -> list[SuggestionCard]:
    cards: list[SuggestionCard] = []
    for column in profile.column_profiles:
        if column.missing_percent > 0:
            cards.append(SuggestionCard(id=f"missing-{column.name}", severity="warning", title=f"Missing values in {column.name}", text=f"{column.missing_percent:.1f}% of values are missing. Add a missing value imputer before modeling.", fix_block={"type": "Missing Values", "params": {"strategy": "median" if column.inferred_type == "numeric" else "most_frequent", "column": column.name}}))
        if column.outlier_percent is not None and column.outlier_percent >= 5:
            cards.append(SuggestionCard(id=f"outliers-{column.name}", severity="info", title=f"Potential outliers in {column.name}", text=f"{column.outlier_percent:.1f}% of numeric values fall outside the IQR range.", fix_block={"type": "Outliers", "params": {"method": "iqr", "column": column.name}}))
    for balance in profile.class_imbalance:
        cards.append(SuggestionCard(id=f"balance-{balance.column}", severity="warning", title=f"Class imbalance in {balance.column}", text=f"The minority class is {balance.minority_percent:.1f}% of observed labels; consider stratified splitting.", fix_block={"type": "Train/Test Split", "params": {"stratify": balance.column}}))
    return cards
