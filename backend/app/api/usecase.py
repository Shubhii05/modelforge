from typing import Any
import re
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/usecase", tags=["usecase"])


class UseCaseRequest(BaseModel):
    use_case: str
    target_column: str | None = None


class GeneratedBlock(BaseModel):
    id: str
    type: str
    label: str
    category: str
    params: dict[str, Any]
    rationale: str


class UseCasePlanResponse(BaseModel):
    project_name: str
    task_type: str
    target_column_hint: str
    recommended_sample: str | None
    summary: str
    blocks: list[GeneratedBlock]
    suggested_dataset_types: list[str]
    next_steps: list[str]


@router.post("/plan", response_model=UseCasePlanResponse)
def plan_initial_pipeline(payload: UseCaseRequest) -> UseCasePlanResponse:
    text = (payload.use_case or "").lower()

    if any(k in text for k in ["churn", "retention", "cancel", "attrition"]):
        project_name = "Customer Churn Prediction"
        target_hint = payload.target_column or "churn"
        sample = "customer_churn"
        summary = "Binary classification to predict subscriber churn risk from usage tenure, contract terms, and support interactions."
        blocks = [
            GeneratedBlock(
                id="b_data",
                type="dataset",
                label="Load Dataset",
                category="data",
                params={"filename": "customer_churn.csv", "target_column": target_hint, "test_size": 0.2},
                rationale="Partition 80% train and 20% hold-out test set.",
            ),
            GeneratedBlock(
                id="b_imputer",
                type="missing_values",
                label="Handle Missing Values",
                category="preprocessing",
                params={"strategy": "median"},
                rationale="Impute missing billing records using median without leaking test distributions.",
            ),
            GeneratedBlock(
                id="b_encoder",
                type="encoding",
                label="Categorical Encoding",
                category="preprocessing",
                params={"method": "onehot"},
                rationale="Encode contract terms and support status into one-hot binary features.",
            ),
            GeneratedBlock(
                id="b_scaler",
                type="scaling",
                label="Feature Scaling",
                category="preprocessing",
                params={"method": "standard"},
                rationale="Standardize numeric tenure and charges to zero-mean unit-variance.",
            ),
            GeneratedBlock(
                id="b_model",
                type="random_forest",
                label="Random Forest",
                category="model",
                params={"n_estimators": 100, "max_depth": 10},
                rationale="Ensemble decision trees capture non-linear subscriber patterns without severe overfitting.",
            ),
            GeneratedBlock(
                id="b_eval",
                type="evaluate",
                label="Evaluate & Metrics",
                category="output",
                params={},
                rationale="Evaluate accuracy, precision, recall, weighted F1, and confusion matrix.",
            ),
        ]

    elif any(k in text for k in ["credit", "default", "fraud", "risk", "loan", "bank"]):
        project_name = "Credit Default Assessment"
        target_hint = payload.target_column or "default_payment"
        sample = "credit_default"
        summary = "Risk scoring model assessing likelihood of borrower default based on credit limits and repayment history."
        blocks = [
            GeneratedBlock(
                id="b_data",
                type="dataset",
                label="Load Dataset",
                category="data",
                params={"filename": "credit_default.csv", "target_column": target_hint, "test_size": 0.2},
                rationale="80/20 train-test partition with stratified class representation.",
            ),
            GeneratedBlock(
                id="b_imputer",
                type="missing_values",
                label="Handle Missing Values",
                category="preprocessing",
                params={"strategy": "median"},
                rationale="Safely replace missing applicant details.",
            ),
            GeneratedBlock(
                id="b_outliers",
                type="outliers",
                label="Outlier Handling",
                category="preprocessing",
                params={"method": "iqr", "threshold": 1.5},
                rationale="Dampen extreme credit bill spikes from skewing model splits.",
            ),
            GeneratedBlock(
                id="b_encoder",
                type="encoding",
                label="Categorical Encoding",
                category="preprocessing",
                params={"method": "onehot"},
                rationale="One-hot encode education, marital status, and payment brackets.",
            ),
            GeneratedBlock(
                id="b_scaler",
                type="scaling",
                label="Feature Scaling",
                category="preprocessing",
                params={"method": "robust"},
                rationale="RobustScaler centers credit balances using median and interquartile range.",
            ),
            GeneratedBlock(
                id="b_model",
                type="random_forest",
                label="Random Forest",
                category="model",
                params={"n_estimators": 120, "max_depth": 8},
                rationale="Balanced tree ensemble resilient to skewed loan distributions.",
            ),
            GeneratedBlock(
                id="b_eval",
                type="evaluate",
                label="Evaluate & Metrics",
                category="output",
                params={},
                rationale="Generate confusion matrix to inspect False Negatives (missed defaults).",
            ),
        ]

    elif any(k in text for k in ["titanic", "surviv", "passenger", "ship"]):
        project_name = "Titanic Survival Prediction"
        target_hint = payload.target_column or "survived"
        sample = "titanic"
        summary = "Predict passenger survival based on passenger class, sex, age, fare, and embarkation port."
        blocks = [
            GeneratedBlock(
                id="b_data",
                type="dataset",
                label="Load Dataset",
                category="data",
                params={"filename": "titanic.csv", "target_column": target_hint, "test_size": 0.2},
                rationale="Hold out 20% for validation.",
            ),
            GeneratedBlock(
                id="b_imputer",
                type="missing_values",
                label="Handle Missing Values",
                category="preprocessing",
                params={"strategy": "median"},
                rationale="Impute missing age with median and embarkation with most frequent.",
            ),
            GeneratedBlock(
                id="b_encoder",
                type="encoding",
                label="Categorical Encoding",
                category="preprocessing",
                params={"method": "onehot"},
                rationale="One-hot encode sex (male/female) and port of embarkation (C, Q, S).",
            ),
            GeneratedBlock(
                id="b_scaler",
                type="scaling",
                label="Feature Scaling",
                category="preprocessing",
                params={"method": "standard"},
                rationale="Scale passenger fare and age features.",
            ),
            GeneratedBlock(
                id="b_model",
                type="random_forest",
                label="Random Forest",
                category="model",
                params={"n_estimators": 100, "max_depth": 6},
                rationale="Captures feature interactions between passenger class and gender.",
            ),
            GeneratedBlock(
                id="b_eval",
                type="evaluate",
                label="Evaluate & Metrics",
                category="output",
                params={},
                rationale="Measure classification accuracy and log loss.",
            ),
        ]

    elif any(k in text for k in ["iris", "flower", "petal", "sepal", "botan", "species"]):
        project_name = "Iris Species Classification"
        target_hint = payload.target_column or "species"
        sample = "iris"
        summary = "Multi-class classification predicting iris botanical species from floral dimension measurements."
        blocks = [
            GeneratedBlock(
                id="b_data",
                type="dataset",
                label="Load Dataset",
                category="data",
                params={"filename": "iris.csv", "target_column": target_hint, "test_size": 0.2},
                rationale="80/20 train/test split on 150 biological specimens.",
            ),
            GeneratedBlock(
                id="b_scaler",
                type="scaling",
                label="Feature Scaling",
                category="preprocessing",
                params={"method": "standard"},
                rationale="Normalize sepal and petal measurements.",
            ),
            GeneratedBlock(
                id="b_model",
                type="logistic_regression",
                label="Logistic Regression",
                category="model",
                params={"C": 1.0, "max_iter": 500},
                rationale="Multinomial logistic regression produces clean decision boundaries for linearly separable species.",
            ),
            GeneratedBlock(
                id="b_eval",
                type="evaluate",
                label="Evaluate & Metrics",
                category="output",
                params={},
                rationale="Multi-class 3x3 confusion matrix and weighted F1 score.",
            ),
        ]

    else:
        # Generic intelligent pipeline
        title = payload.use_case.strip()
        if len(title) > 35:
            words = title.split()[:4]
            title = " ".join(words).title()
        project_name = f"{title or 'ML'} Pipeline"
        target_hint = payload.target_column or "target"
        sample = None
        summary = f"Custom pipeline tailored for: '{payload.use_case or 'Tabular classification'}'."
        blocks = [
            GeneratedBlock(
                id="b_data",
                type="dataset",
                label="Load Dataset",
                category="data",
                params={"target_column": target_hint, "test_size": 0.2},
                rationale="80/20 train/test evaluation split.",
            ),
            GeneratedBlock(
                id="b_imputer",
                type="missing_values",
                label="Handle Missing Values",
                category="preprocessing",
                params={"strategy": "median"},
                rationale="Impute missing numbers with median and text categories with mode.",
            ),
            GeneratedBlock(
                id="b_encoder",
                type="encoding",
                label="Categorical Encoding",
                category="preprocessing",
                params={"method": "onehot"},
                rationale="One-hot encode categorical features.",
            ),
            GeneratedBlock(
                id="b_scaler",
                type="scaling",
                label="Feature Scaling",
                category="preprocessing",
                params={"method": "standard"},
                rationale="Standardize numerical features for uniform gradient scaling.",
            ),
            GeneratedBlock(
                id="b_model",
                type="random_forest",
                label="Random Forest",
                category="model",
                params={"n_estimators": 100, "max_depth": 10},
                rationale="Robust non-linear classifier suitable for general tabular datasets.",
            ),
            GeneratedBlock(
                id="b_eval",
                type="evaluate",
                label="Evaluate & Metrics",
                category="output",
                params={},
                rationale="Compute multi-metric evaluation and confusion matrix.",
            ),
        ]

    return UseCasePlanResponse(
        project_name=project_name,
        task_type="classification",
        target_column_hint=target_hint,
        recommended_sample=sample,
        summary=summary,
        blocks=blocks,
        suggested_dataset_types=["CSV tabular file", "Includes labeled target column", "Mixed numeric and categorical attributes"],
        next_steps=[
            "1. Pipeline canvas populated with recommended blocks",
            "2. Upload your CSV dataset or select the recommended sample dataset",
            "3. Review dataset-specific suggestions and accept enhancements",
            "4. Run training to train your model with real scikit-learn weights",
        ],
    )
