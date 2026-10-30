from dataclasses import dataclass


ConstructorArgument = str | tuple[str, object]


@dataclass(frozen=True)
class BlockDefinition:
    import_path: str
    class_name: str
    constructor_params: tuple[ConstructorArgument, ...]


# The sole block-to-library mapping used by the generic code renderer.
BLOCK_LOOKUP: dict[str, BlockDefinition] = {
    "Missing Values": BlockDefinition("sklearn.impute", "SimpleImputer", ("strategy", "fill_value")),
    "Scaling": BlockDefinition("sklearn.preprocessing", "StandardScaler", ()),
    "Encoding": BlockDefinition("sklearn.preprocessing", "OneHotEncoder", (("handle_unknown", "ignore"),)),
    "Outliers": BlockDefinition("sklearn.preprocessing", "RobustScaler", ()),
    "Random Forest": BlockDefinition("sklearn.ensemble", "RandomForestClassifier", ("n_estimators", "max_depth", "random_state")),
    "XGBoost": BlockDefinition("xgboost", "XGBClassifier", ("n_estimators", "max_depth", "learning_rate", "random_state", ("eval_metric", "logloss"))),
    "Logistic Regression": BlockDefinition("sklearn.linear_model", "LogisticRegression", ("C", "max_iter", "random_state")),
    "SVM": BlockDefinition("sklearn.svm", "SVC", ("C", "kernel")),
}

SCALER_CLASSES = {
    "standard": "StandardScaler",
    "minmax": "MinMaxScaler",
    "robust": "RobustScaler",
}
ENCODER_CLASSES = {"onehot": "OneHotEncoder", "ordinal": "OrdinalEncoder"}


def definition_for(block_type: str, params: dict[str, str | int | float | bool | None]) -> BlockDefinition:
    definition = BLOCK_LOOKUP[block_type]
    if block_type == "Scaling":
        return BlockDefinition("sklearn.preprocessing", SCALER_CLASSES[str(params.get("method", "standard"))], ())
    if block_type == "Encoding":
        encoder = ENCODER_CLASSES[str(params.get("method", "onehot"))]
        constructor = (("handle_unknown", "ignore"),) if encoder == "OneHotEncoder" else ()
        return BlockDefinition("sklearn.preprocessing", encoder, constructor)
    return definition
