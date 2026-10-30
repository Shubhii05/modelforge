# API contract

Base path: `/api`; JSON responses use snake_case.

## Datasets (B1)

- `POST /datasets?filename=<name.csv>` — send raw CSV bytes as the request body; returns `DatasetOut`.
- `GET /datasets` — returns `DatasetOut[]`.
- `GET /datasets/{dataset_id}/profile` — returns row/column counts, per-column inferred type, missing percentage, cardinality, skew, outlier percentage and date-like flag, plus categorical class imbalance summaries.
- `GET /datasets/{dataset_id}/suggestions` — returns suggestion cards with `id`, `severity`, `title`, `text`, and a typed `fix_block` (`type`, `params`).
- `GET /health` — `{"status":"ok"}`.

`DatasetOut`: `{id, name, filename, size_bytes, created_at}`. CSV uploads are limited to 25 MB. Later phases will extend this contract for pipelines, training, code generation, and LLM drafting.
