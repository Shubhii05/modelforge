from typing import Any
import os
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/assistant", tags=["assistant"])


class AssistantChatRequest(BaseModel):
    message: str
    context: dict[str, Any] | None = None


class ActionSuggestion(BaseModel):
    label: str
    action_type: str  # e.g., 'apply_suggestion', 'run_training', 'open_playground', 'add_block'
    payload: dict[str, Any] | None = None


class AssistantChatResponse(BaseModel):
    reply: str
    current_step: int  # 1..5
    step_name: str
    suggestions: list[str]
    actions: list[ActionSuggestion]


def _determine_step(context: dict[str, Any]) -> tuple[int, str]:
    has_dataset = bool(context.get("dataProfile") or context.get("datasetId"))
    has_results = bool(context.get("runResults"))
    is_running = bool(context.get("isRunning"))
    blocks = context.get("blocks") or []
    has_model = any(b.get("type") in ["random_forest", "xgboost", "logistic_regression", "svm"] for b in blocks)

    if is_running:
        return 4, "Training in Progress"
    if has_results:
        return 5, "Inference & Diagnostics"
    if has_dataset and has_model:
        return 3, "Pipeline Architecture Ready"
    if has_dataset:
        return 3, "Data Profiled — Review Pipeline"
    return 1, "Use Case & Problem Definition"


def _generate_rule_based_reply(message: str, context: dict[str, Any]) -> tuple[str, list[str], list[ActionSuggestion]]:
    msg = message.lower()
    profile = context.get("dataProfile")
    results = context.get("runResults")
    blocks = context.get("blocks") or []
    dataset_id = context.get("datasetId")

    step_num, step_name = _determine_step(context)
    actions: list[ActionSuggestion] = []
    quick_suggestions: list[str] = []

    # 1. Questions about models / algorithms
    if any(k in msg for k in ["model", "algorithm", "random forest", "xgboost", "logistic", "svm", "classifier"]):
        reply = (
            "**Model Selection Guidance:**\n\n"
            "- **Random Forest**: Best baseline for tabular data. Handles non-linear interactions, resists overfitting, and requires minimal hyperparameter tuning.\n"
            "- **XGBoost**: Gradient boosted decision trees. Often achieves highest accuracy on competitive tabular benchmarks, but sensitive to learning rate.\n"
            "- **Logistic Regression**: Fast, linear, highly interpretable. Best when classes are linearly separable or when probabilistic calibration is paramount.\n"
            "- **SVM**: Effective in high-dimensional feature spaces with clear margin separation (using RBF or Linear kernel)."
        )
        quick_suggestions = ["How do I improve model accuracy?", "Explain my evaluation metrics", "What hyperparameters should I tune?"]
        actions = [
            ActionSuggestion(label="Switch to Random Forest", action_type="set_model", payload={"type": "random_forest"}),
            ActionSuggestion(label="Switch to XGBoost", action_type="set_model", payload={"type": "xgboost"}),
        ]
        return reply, quick_suggestions, actions

    # 2. Questions about dataset or missing values
    if any(k in msg for k in ["missing", "impute", "nan", "null", "clean"]):
        if profile and profile.get("columns"):
            missing_cols = [c["name"] for c in profile["columns"] if c.get("missing_pct", 0) > 0]
            if missing_cols:
                reply = (
                    f"**Missing Values Found:**\n\n"
                    f"Columns with missing values: **{', '.join(missing_cols)}**.\n\n"
                    "We recommend adding a **Missing Values** block with `median` strategy for numeric fields and `most_frequent` for categorical fields. "
                    "This prevents data leakage and ensures test records can be imputed safely."
                )
            else:
                reply = "**No Missing Values!** Your dataset has complete values across all columns. You can safely proceed to model training."
        else:
            reply = "Upload a dataset or select a sample dataset (Iris, Titanic, Churn) to analyze missing values."
        quick_suggestions = ["Check for outliers", "Do I need feature scaling?", "How to handle class imbalance?"]
        actions = [ActionSuggestion(label="Add Missing Value Imputer", action_type="add_block", payload={"type": "missing_values"})]
        return reply, quick_suggestions, actions

    # 3. Questions about results / metrics / evaluation
    if any(k in msg for k in ["metric", "accuracy", "f1", "precision", "loss", "confusion matrix", "result", "evaluate"]):
        if results:
            acc = results.get("accuracy", 0) * 100
            f1 = results.get("f1", 0)
            prec = results.get("precision", 0) * 100
            loss = results.get("loss", 0)
            reply = (
                f"**Evaluation Summary:**\n\n"
                f"- **Accuracy: {acc:.1f}%** — Proportion of correct predictions overall.\n"
                f"- **F1 Score: {f1:.3f}** — Harmonic mean of precision and recall (weighted across classes).\n"
                f"- **Precision: {prec:.1f}%** — How often positive predictions were true positives.\n"
                f"- **Log Loss: {loss:.3f}** — Cross-entropy penalty on predicted probabilities.\n\n"
                "**Diagnosis:** If accuracy is significantly higher than F1, look out for class imbalance. "
                "Open the **Playground** tab to test individual inference rows with your trained model!"
            )
            actions = [ActionSuggestion(label="Test in Playground", action_type="open_playground", payload={})]
        else:
            reply = "You haven't run model training yet! Click **Run Pipeline** in the top bar to train the model on your dataset with real scikit-learn weights."
            if dataset_id:
                actions = [ActionSuggestion(label="Train Model Now", action_type="run_training", payload={})]
        quick_suggestions = ["What does log loss measure?", "How to reduce overfitting?", "Can I test predictions live?"]
        return reply, quick_suggestions, actions

    # 4. Questions about scaling / outliers / encoding
    if any(k in msg for k in ["scale", "scaler", "outlier", "encode", "onehot"]):
        reply = (
            "**Preprocessing Best Practices:**\n\n"
            "- **Feature Scaling (StandardScaler)**: Centers features to mean 0, variance 1. Essential for Logistic Regression and SVM, optional for Decision Trees.\n"
            "- **RobustScaler / Outliers**: Uses median and IQR. Ideal when data has extreme outliers or heavy skew.\n"
            "- **Categorical Encoding (One-Hot)**: Converts string categories (e.g., 'Male'/'Female', 'Contract') into binary indicator columns."
        )
        quick_suggestions = ["Add feature scaling", "Add categorical encoding", "Add outlier treatment"]
        return reply, quick_suggestions, actions

    # 5. Default contextual guide
    if step_num == 1:
        reply = (
            "**Welcome to ModelForge!**\n\n"
            "I'll guide you step-by-step through building, training, and testing your machine learning model.\n\n"
            "**Next Step:** Describe your use case in the input above (e.g. *'Customer Churn Prediction'* or *'Titanic Survival'*) "
            "or pick a pre-configured template to generate your initial pipeline."
        )
        quick_suggestions = ["Predict Customer Churn", "Titanic Survival Prediction", "Iris Flower Classification", "Credit Default Assessment"]
        actions = [
            ActionSuggestion(label="Churn Pipeline", action_type="usecase_preset", payload={"preset": "churn"}),
            ActionSuggestion(label="Titanic Pipeline", action_type="usecase_preset", payload={"preset": "titanic"}),
        ]
    elif step_num == 2 or (not profile):
        reply = (
            "**Pipeline Drafted! Next: Data Upload**\n\n"
            "Your initial pipeline architecture is on the canvas. Now upload your CSV file or select a sample dataset below "
            "(like Iris, Titanic, or Customer Churn) to profile columns and generate dataset-specific suggestions."
        )
        quick_suggestions = ["Load Iris sample", "Load Titanic sample", "Load Churn sample"]
        actions = [
            ActionSuggestion(label="Load Titanic Dataset", action_type="load_sample", payload={"key": "titanic"}),
            ActionSuggestion(label="Load Churn Dataset", action_type="load_sample", payload={"key": "customer_churn"}),
        ]
    elif step_num == 3:
        reply = (
            f"**Dataset Profiled ({profile.get('rows', 0)} rows, {profile.get('cols', 0)} columns)!**\n\n"
            "Review the suggestions on the right panel. Accepting suggestions will tailor the pipeline blocks (missing values, scaling, encoding) specifically to your dataset. "
            "When ready, click **Run Pipeline** to train the model!"
        )
        quick_suggestions = ["Why should I scale features?", "What algorithm should I use?", "Run pipeline training"]
        actions = [ActionSuggestion(label="Run Pipeline Training", action_type="run_training", payload={})]
    else:
        reply = (
            "**Model Trained!**\n\n"
            "Your model is fitted with real scikit-learn weights and ready for evaluation. "
            "Inspect the learning curve and confusion matrix in the **Results** tab, or go to **Playground** to test live predictions."
        )
        quick_suggestions = ["Go to Playground", "Retrain with XGBoost", "Explain confusion matrix"]
        actions = [ActionSuggestion(label="Test in Playground", action_type="open_playground", payload={})]

    return reply, quick_suggestions, actions


@router.post("/chat", response_model=AssistantChatResponse)
def assistant_chat(payload: AssistantChatRequest) -> AssistantChatResponse:
    context = payload.context or {}
    step_num, step_name = _determine_step(context)

    # Check if external OpenAI LLM is available for augmented reasoning
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            endpoint = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            system_prompt = (
                "You are the ModelForge AI ML Assistant. You guide the user step-by-step through ML pipeline building, "
                "data profiling, algorithm selection, hyperparameter tuning, and metric diagnostics. Keep answers concise, "
                "practical, and formatted in Markdown."
            )
            body = json.dumps({
                "model": model,
                "temperature": 0.3,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Context: {json.dumps(context, ensure_ascii=False)}\n\nUser Question: {payload.message}"}
                ]
            }).encode()
            req = Request(endpoint, data=body, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
            with urlopen(req, timeout=15) as res:
                result = json.loads(res.read())
                reply = result["choices"][0]["message"]["content"]
                return AssistantChatResponse(
                    reply=reply,
                    current_step=step_num,
                    step_name=step_name,
                    suggestions=["How do I improve model accuracy?", "Explain evaluation metrics", "Test predictions in Playground"],
                    actions=[],
                )
        except Exception:
            pass

    # Expert rule-based response
    reply, suggestions, actions = _generate_rule_based_reply(payload.message, context)
    return AssistantChatResponse(
        reply=reply,
        current_step=step_num,
        step_name=step_name,
        suggestions=suggestions,
        actions=actions,
    )
