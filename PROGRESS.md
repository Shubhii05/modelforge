# Progress

- [x] B1: backend scaffold, configuration, SQLAlchemy dataset model, CSV upload/list, profiler, and suggestion cards.
- [x] B2: pipeline CRUD, block catalog/docs, parameter validation.
- [x] B3: code generation from pipeline specs, dataset/split/train templates, and generated code snapshot coverage.
- [x] B4: sklearn training, SSE metrics, prediction, and joblib model export.
- [x] B5: LLM drafting and custom code proposal.
- [x] I1: frontend API integration for dataset upload/profiling/suggestions and pipeline training.
- [x] I2: evaluation coverage, check script, CI, and README.
- [x] F1: Plain-text use case input with automated initial pipeline planning, target detection, and layout generation.
- [x] F2: Real backend model training (scikit-learn / XGBoost) with complete joblib persistence and live playground inference without dummy values.
- [x] F3: Interactive AI Co-Pilot Assistant guiding the user across all 5 stages of machine learning model building.
- [x] F4: Built-in sample datasets (Iris, Titanic, Customer Churn, Credit Default) with 1-click loading and dataset-tailored preprocessing suggestions.

API contract is documented in `docs/api.md`. The frontend consumes the backend API for profiling, suggestions, pipeline code generation, training, and real inference.
