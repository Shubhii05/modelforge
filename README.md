# ModelForge

ModelForge is a visual machine learning pipeline builder. The React frontend lets you upload and profile CSV datasets, configure preprocessing and classifier blocks, and train pipelines through the FastAPI backend. The backend also generates Python and can return optional LLM pipeline and custom transformer proposals.

## Requirements

- Node.js 20 or newer and npm
- Python 3.11 or newer

## Run locally

In one terminal, install and start the API:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
Set-Location backend
python -m uvicorn app.main:app --reload
```

In another terminal, install and start the frontend:

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The API listens on `http://localhost:8000`; interactive API docs are at `/docs`. Set `VITE_API_URL` to override the frontend API base URL (it defaults to `http://localhost:8000/api`). The API allows the Vite localhost origins by default; set comma-separated `CORS_ORIGINS` to change them.

CSV uploads are capped at 25 MB. The backend stores SQLite data in `modelforge.db`, uploaded CSV files in `datasets/`, and trained joblib artifacts in `backend/artifacts/`. Set `DATABASE_URL`, `DATASET_DIR`, or `ARTIFACT_DIR` to change these locations.

LLM drafting is optional. Set `OPENAI_API_KEY`; optionally set `OPENAI_BASE_URL` and `OPENAI_MODEL`. The draft endpoint returns proposals for review and does not execute proposed code.

## Checks

Run the frontend tests and production build:

```powershell
npm test
npm run build
```

Run backend tests from the backend directory:

```powershell
Set-Location backend
python -m pytest tests
```

Or run all checks with `powershell -ExecutionPolicy Bypass -File scripts/check.ps1` from the repository root.

## API overview

The API contract, request examples, and response behavior are documented in [docs/api.md](docs/api.md). Main endpoints cover dataset upload/profile/suggestions, pipeline CRUD and validation, code generation, SSE training, prediction/export, and optional LLM drafting.

## Project layout

- `src/` — React, TypeScript, canvas UI, API client, and frontend tests
- `backend/app/` — FastAPI routes, schemas, profiling, code generation, and model training
- `backend/tests/` — backend unit and integration coverage
- `docs/` — [API contract](docs/api.md), [dashboard reference](docs/assets/dashboard-reference.png), and [project paper](docs/assets/project-paper.pdf)
- `PROGRESS.md` — implementation checklist
