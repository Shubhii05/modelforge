# API contract

Base path: `/api`; JSON responses use snake_case.

## Datasets (B1)

- `POST /datasets?filename=<name.csv>` — send raw CSV bytes as the request body; returns `DatasetOut`.
- `GET /datasets` — returns `DatasetOut[]`.
- `GET /datasets/{dataset_id}/profile` — returns row/column counts, per-column inferred type, missing percentage, cardinality, skew, outlier percentage and date-like flag, plus categorical class imbalance summaries.
- `GET /datasets/{dataset_id}/suggestions` — returns suggestion cards with `id`, `severity`, `title`, `text`, and a typed `fix_block` (`type`, `params`).
- `GET /health` — `{"status":"ok"}`.

`DatasetOut`: `{id, name, filename, size_bytes, created_at}`. CSV uploads are limited to 25 MB. Later phases will extend this contract for pipelines, training, code generation, and LLM drafting.

## Pipelines and blocks (B2)

- `GET /blocks` — list supported block types, categories, descriptions, and parameter definitions.
- `POST /blocks/validate` — body `{type, params}`; returns normalized `{valid, type, params}` or `422` for an unknown type or invalid parameters.
- `POST /pipelines` — body `{name, dataset_id?, blocks:[{id,type,params}]}`; validates every block and returns a persisted pipeline.
- `GET /pipelines` and `GET /pipelines/{pipeline_id}` — list or retrieve pipelines.
- `PUT /pipelines/{pipeline_id}` — replace pipeline name, dataset, and blocks after validation.
- `DELETE /pipelines/{pipeline_id}` — remove a pipeline (`204`).

Supported blocks: Missing Values, Scaling, Encoding, Outliers, Train/Test Split, Random Forest, XGBoost, Logistic Regression, and SVM. Parameter constraints and defaults are published in `GET /blocks` and enforced by both pipeline writes and block validation.

## Code generation (B3)

- `POST /pipelines/{pipeline_id}/code` — body `{target_column}`; returns `{pipeline_id, filename, target_column, code}`. Generates executable Python using the saved pipeline spec and dataset. It returns `422` if the dataset/target is unavailable or the pipeline does not contain exactly one model block.

## Training and models (B4)

- `POST /pipelines/{pipeline_id}/train` — body `{target_column}`; streams Server-Sent Events named `started`, `metric`, `complete`, or `error`. Each `metric` includes iteration, accuracy, loss, confusion matrix, precision, and F1. A completed run persists the fitted sklearn Pipeline as a joblib artifact.
- `POST /models/{run_id}/predict` — body `{rows:[{feature:value}]}`; returns predictions and per-class probabilities when the estimator supports them.
- `GET /models/{run_id}/export` — downloads the saved `.joblib` model artifact.

The same training pipeline handles Missing Values, Scaling, Encoding, and Outliers blocks with Random Forest, XGBoost, Logistic Regression, or SVM estimators. Random Forest, XGBoost, and Logistic Regression report progressive iteration metrics; SVM reports its fitted result.
