from collections.abc import Iterator
from pathlib import Path

import joblib
import pandas as pd
from pandas.api.types import is_numeric_dtype
from sklearn.base import BaseEstimator
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, log_loss, precision_score
from sklearn.pipeline import Pipeline as SklearnPipeline
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder, OrdinalEncoder, RobustScaler, StandardScaler
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sqlalchemy.orm import Session

from app.core.config import ARTIFACT_DIR
from app.models.dataset import Dataset
from app.models.pipeline import Pipeline
from app.models.training_run import TrainingRun
from app.schemas.pipeline import PipelineBlock
from app.schemas.training import TrainingComplete, TrainingMetric
from app.services.block_catalog import validate_block


def _load_blocks(pipeline: Pipeline) -> list[PipelineBlock]:
    return [PipelineBlock.model_validate(item) for item in pipeline.blocks]


def _estimator(block: PipelineBlock) -> BaseEstimator:
    params = validate_block(block.type, block.params).params.root
    if block.type == "Random Forest":
        return RandomForestClassifier(
            n_estimators=int(params.get("n_estimators", 100)),
            max_depth=params.get("max_depth"),
            random_state=int(params.get("random_state", 42)),
            warm_start=True,
            n_jobs=1,
        )
    if block.type == "XGBoost":
        from xgboost import XGBClassifier

        return XGBClassifier(
            n_estimators=int(params.get("n_estimators", 100)),
            max_depth=int(params.get("max_depth", 6)),
            learning_rate=float(params.get("learning_rate", 0.1)),
            random_state=int(params.get("random_state", 42)),
            eval_metric="logloss",
            n_jobs=1,
        )
    if block.type == "Logistic Regression":
        return LogisticRegression(
            C=float(params.get("C", 1.0)),
            max_iter=int(params.get("max_iter", 1000)),
            random_state=int(params.get("random_state", 42)),
            warm_start=True,
        )
    if block.type == "SVM":
        return SVC(C=float(params.get("C", 1.0)), kernel=str(params.get("kernel", "rbf")), probability=True)
    raise ValueError(f"Unsupported model block: {block.type}")


def _steps_for(columns: list[str], blocks: list[PipelineBlock], numeric: bool) -> list[tuple[str, object]]:
    steps: list[tuple[str, object]] = []
    for index, block in enumerate(blocks):
        if block.type == "Missing Values":
            params = validate_block(block.type, block.params).params.root
            strategy = str(params.get("strategy", "median"))
            if not numeric and strategy in {"mean", "median"}:
                strategy = "most_frequent"
            fill_value = params.get("fill_value")
            steps.append((f"imputer_{index}", SimpleImputer(strategy=strategy, fill_value=fill_value, keep_empty_features=True)))
        elif numeric and block.type == "Scaling":
            method = validate_block(block.type, block.params).params.root.get("method", "standard")
            scaler = {"standard": StandardScaler, "minmax": MinMaxScaler, "robust": RobustScaler}[str(method)]
            steps.append((f"scaler_{index}", scaler()))
        elif numeric and block.type == "Outliers":
            steps.append((f"outlier_treatment_{index}", RobustScaler()))
        elif not numeric and block.type == "Encoding":
            method = validate_block(block.type, block.params).params.root.get("method", "onehot")
            encoder = OneHotEncoder(handle_unknown="ignore") if method == "onehot" else OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
            steps.append((f"encoder_{index}", encoder))
    return steps


def _build_pipeline(X: pd.DataFrame, blocks: list[PipelineBlock], model_block: PipelineBlock) -> SklearnPipeline:
    numeric_columns = [str(column) for column in X.columns if is_numeric_dtype(X[column])]
    categorical_columns = [str(column) for column in X.columns if column not in numeric_columns]
    transformers: list[tuple[str, object, list[str]]] = []
    if numeric_columns:
        numeric_steps = _steps_for(numeric_columns, blocks, numeric=True)
        if numeric_steps:
            transformers.append(("numeric", SklearnPipeline(numeric_steps), numeric_columns))
    if categorical_columns:
        categorical_steps = _steps_for(categorical_columns, blocks, numeric=False)
        if categorical_steps:
            transformers.append(("categorical", SklearnPipeline(categorical_steps), categorical_columns))
    preprocess: object = ColumnTransformer(transformers, remainder="passthrough", verbose_feature_names_out=False) if transformers else "passthrough"
    return SklearnPipeline([("preprocess", preprocess), ("model", _estimator(model_block))])


def _metric(iteration: int, model: SklearnPipeline, X_test: pd.DataFrame, y_test: pd.Series) -> TrainingMetric:
    predicted = model.predict(X_test)
    accuracy = float(accuracy_score(y_test, predicted))
    labels = getattr(model, "classes_")
    matrix = confusion_matrix(y_test, predicted, labels=labels).astype(int).tolist()
    precision = float(precision_score(y_test, predicted, average="weighted", zero_division=0))
    f1 = float(f1_score(y_test, predicted, average="weighted", zero_division=0))
    if hasattr(model, "predict_proba"):
        loss = float(log_loss(y_test, model.predict_proba(X_test), labels=labels))
    else:
        loss = 1.0 - accuracy
    return TrainingMetric(iteration=iteration, accuracy=accuracy, loss=loss,
                          confusion_matrix=matrix, precision=precision, f1=f1)


def train_pipeline_events(db: Session, pipeline: Pipeline, dataset: Dataset, target_column: str) -> Iterator[dict[str, str]]:
    """Fit the configured sklearn Pipeline and yield SSE event records."""
    blocks = _load_blocks(pipeline)
    model_blocks = [block for block in blocks if block.type in {"Random Forest", "XGBoost", "Logistic Regression", "SVM"}]
    if len(model_blocks) != 1:
        raise ValueError("Training requires exactly one model block")
    frame = pd.read_csv(dataset.path)
    if not len(frame) or frame.empty:
        raise ValueError("Dataset is empty")
    if not isinstance(target_column, str) or target_column not in frame.columns:
        raise ValueError("A valid target column is required")
    clean = frame.dropna(subset=[target_column])
    y = clean[target_column]
    X = clean.drop(columns=[target_column])
    if X.empty or y.nunique() < 2:
        raise ValueError("Training requires at least one feature and two target classes")
    split = next((block for block in blocks if block.type == "Train/Test Split"), None)
    split_params = validate_block(split.type, split.params).params.root if split else {"test_size": 0.2, "random_state": 42, "stratify": None}
    stratify = y if split_params.get("stratify") else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=float(split_params.get("test_size", 0.2)),
        random_state=int(split_params.get("random_state", 42)),
        stratify=stratify,
    )
    estimator = _build_pipeline(X_train, blocks, model_blocks[0])
    final_model_params = validate_block(model_blocks[0].type, model_blocks[0].params).params.root
    if model_blocks[0].type in {"Random Forest", "XGBoost"}:
        total = int(final_model_params.get("n_estimators", 100))
        checkpoints = sorted(set([min(total, max(1, round(total * fraction / 10))) for fraction in range(1, 11)]))
        for iteration, tree_count in enumerate(checkpoints, start=1):
            estimator.set_params(model__n_estimators=tree_count)
            estimator.fit(X_train, y_train)
            metric = _metric(iteration, estimator, X_test, y_test)
            yield {"event": "metric", "data": metric.model_dump_json()}
    elif model_blocks[0].type == "Logistic Regression":
        total = int(final_model_params.get("max_iter", 1000))
        checkpoints = sorted(set([min(total, max(1, round(total * fraction / 10))) for fraction in range(1, 11)]))
        for iteration, iteration_count in enumerate(checkpoints, start=1):
            estimator.set_params(model__max_iter=iteration_count)
            estimator.fit(X_train, y_train)
            metric = _metric(iteration, estimator, X_test, y_test)
            yield {"event": "metric", "data": metric.model_dump_json()}
    else:
        estimator.fit(X_train, y_train)
        metric = _metric(1, estimator, X_test, y_test)
        yield {"event": "metric", "data": metric.model_dump_json()}

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    run = TrainingRun(pipeline_id=pipeline.id, dataset_id=dataset.id, target_column=target_column,
                      artifact_path="", accuracy=metric.accuracy)
    db.add(run)
    db.flush()
    artifact_path = ARTIFACT_DIR / f"model-{run.id}.joblib"
    joblib.dump(estimator, artifact_path)
    run.artifact_path = str(artifact_path)
    db.commit()
    yield {"event": "complete", "data": TrainingComplete(run_id=run.id, accuracy=metric.accuracy).model_dump_json()}
