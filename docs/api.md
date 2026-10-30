# API contract

Base path: `/api`; JSON responses use snake_case.

## Datasets (B1)

- `POST /datasets?filename=<name.csv>` — send raw CSV bytes as the request body; returns `DatasetOut`.
- `GET /datasets` — returns `DatasetOut[]`.
- `GET /datasets/{dataset_id}/profile` — returns row/column counts, per-column inferred type, missing percentage, cardinality, skew, outlier percentage and date-like flag, plus categorical class imbalance summaries.
- `GET /datasets/{dataset_id}/suggestions` — returns suggestion cards with `id`, `severity`, `title`, `text`, and a typed `fix_block` (`type`, `params`).
- `GET /health` — `{"status":"ok"}`.

`DatasetOut`: `{id, name, filename, size_bytes, created_at}`. CSV uploads are limited to 25 MB.

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

## LLM drafting and custom code proposals (B5)

- `POST /pipelines/{pipeline_id}/draft` — body `{target_column, goal?}`; returns a validated proposed block list, optional Python transformer code, and rationale. The draft is advisory and is not saved onto the pipeline or executed. Missing provider credentials or malformed/provider-error responses yield the default train/test split and random-forest proposal.
- `POST /custom-code/validate` — body `{code}`; validates syntax and rejects OS, subprocess, socket, file-open, dynamic-import, eval, and exec operations. The UI changes custom-code status to accepted only after this endpoint returns `{valid:true}`.
- Configure an OpenAI-compatible chat completions provider with `OPENAI_API_KEY`; optionally set `OPENAI_BASE_URL` (defaults to `https://api.openai.com/v1`) and `OPENAI_MODEL` (defaults to `gpt-4o-mini`). Returns `422` for invalid dataset/target and `502` for structurally invalid proposals. Proposed custom code is syntax checked and rejects OS, subprocess, socket, file-open, dynamic-import, eval, and exec operations.
