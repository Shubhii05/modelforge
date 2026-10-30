import type { PipelineBlock, BlockType, BlockParams } from '../types/pipeline'

// ── Import lookup table ─────────────────────────────────────────────────────
const IMPORTS: Record<BlockType, string[]> = {
  dataset: [
    'import pandas as pd',
    'from sklearn.model_selection import train_test_split',
  ],
  missing_values: ['from sklearn.impute import SimpleImputer'],
  scaling: ['from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler'],
  encoding: ['from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, LabelEncoder'],
  outliers: ['import numpy as np'],
  custom_code: [],
  random_forest: ['from sklearn.ensemble import RandomForestClassifier'],
  xgboost: ['from xgboost import XGBClassifier'],
  logistic_regression: ['from sklearn.linear_model import LogisticRegression'],
  svm: ['from sklearn.svm import SVC'],
  evaluate: [
    'from sklearn.metrics import accuracy_score, precision_score, f1_score, confusion_matrix, log_loss',
  ],
}

// ── Per-block snippet generators ────────────────────────────────────────────
function genDataset(p: BlockParams): string {
  const target = p.target_column ?? 'target'
  const split = p.test_size ?? 0.2
  return `# ── Load Dataset ──────────────────────────────────────────────
df = pd.read_csv("dataset.csv")
X = df.drop(columns=["${target}"])
y = df["${target}"]
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=${split}, random_state=42, stratify=y
)`
}

function genMissingValues(p: BlockParams): string {
  const strategy = p.strategy ?? 'median'
  const extra = strategy === 'constant' ? `, fill_value="${p.fill_value ?? 0}"` : ''
  return `# ── Handle Missing Values ─────────────────────────────────────
imputer = SimpleImputer(strategy="${strategy}"${extra})
X_train = imputer.fit_transform(X_train)
X_test  = imputer.transform(X_test)`
}

function genScaling(p: BlockParams): string {
  const scalerMap: Record<string, string> = {
    standard: 'StandardScaler()',
    minmax: 'MinMaxScaler()',
    robust: 'RobustScaler()',
  }
  const scaler = scalerMap[p.scaler ?? 'standard']
  return `# ── Feature Scaling ───────────────────────────────────────────
scaler = ${scaler}
X_train = scaler.fit_transform(X_train)
X_test  = scaler.transform(X_test)`
}

function genEncoding(p: BlockParams): string {
  const enc = p.encoding ?? 'onehot'
  const cls =
    enc === 'onehot' ? 'OneHotEncoder(sparse_output=False, handle_unknown="ignore")'
    : enc === 'ordinal' ? 'OrdinalEncoder()'
    : 'LabelEncoder()'
  return `# ── Encode Categorical ────────────────────────────────────────
encoder = ${cls}
X_train = encoder.fit_transform(X_train)
X_test  = encoder.transform(X_test)`
}

function genOutliers(p: BlockParams): string {
  const method = p.method ?? 'iqr'
  const threshold = p.threshold ?? 1.5
  if (method === 'iqr') {
    return `# ── Outlier Removal (IQR) ─────────────────────────────────────
Q1, Q3 = np.percentile(X_train, [25, 75], axis=0)
IQR = Q3 - Q1
mask = np.all((X_train >= Q1 - ${threshold} * IQR) & (X_train <= Q3 + ${threshold} * IQR), axis=1)
X_train, y_train = X_train[mask], y_train[mask]`
  }
  return `# ── Outlier Removal (Z-Score) ─────────────────────────────────
from scipy import stats
z_scores = np.abs(stats.zscore(X_train))
mask = np.all(z_scores < ${threshold}, axis=1)
X_train, y_train = X_train[mask], y_train[mask]`
}

function genModel(type: BlockType, p: BlockParams): string {
  const headers: Record<string, string> = {
    random_forest: 'Random Forest',
    xgboost: 'XGBoost',
    logistic_regression: 'Logistic Regression',
    svm: 'SVM',
  }
  const constructors: Record<string, string> = {
    random_forest: `RandomForestClassifier(n_estimators=${p.n_estimators ?? 100}, max_depth=${p.max_depth ?? 10}, random_state=42)`,
    xgboost: `XGBClassifier(n_estimators=${p.n_estimators ?? 100}, max_depth=${p.max_depth ?? 6}, learning_rate=${p.learning_rate ?? 0.1}, random_state=42, eval_metric="logloss")`,
    logistic_regression: `LogisticRegression(C=${p.C ?? 1.0}, penalty="${p.penalty ?? 'l2'}", max_iter=1000, random_state=42)`,
    svm: `SVC(kernel="${p.kernel ?? 'rbf'}", C=${p.C ?? 1.0}, gamma="${p.gamma ?? 'scale'}", probability=True)`,
  }
  return `# ── Train: ${headers[type]} ──────────────────────────────────
model = ${constructors[type]}
model.fit(X_train, y_train)`
}

function genEvaluate(): string {
  return `# ── Evaluate & Metrics ────────────────────────────────────────
y_pred  = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

accuracy  = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred, average="weighted", zero_division=0)
f1        = f1_score(y_test, y_pred, average="weighted", zero_division=0)
loss      = log_loss(y_test, y_proba)
cm        = confusion_matrix(y_test, y_pred)

print(f"Accuracy : {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"F1 Score : {f1:.4f}")
print(f"Log Loss : {loss:.4f}")
print(f"Confusion Matrix:\\n{cm}")`
}

function genCustomCode(p: BlockParams): string {
  const code = p.code ?? '# Custom sklearn transformer\n'
  const status = p.custom_code_status ?? 'pending'
  const statusComment =
    status === 'pending' ? '# ⚠ AI-generated — awaiting review (Accept / Reject in UI)'
    : status === 'accepted' ? '# ✓ AI-generated block — accepted by user'
    : status === 'rejected' ? '# ✗ AI-generated block — REJECTED (will not execute)'
    : '# ✎ AI-generated block — being edited'
  return `# ── Custom Code Block ─────────────────────────────────────────
${statusComment}
${code}`
}

// ── Main generator ──────────────────────────────────────────────────────────
export function generateCode(blocks: PipelineBlock[]): string {
  if (blocks.length === 0) {
    return '# Add blocks to the canvas to generate code.'
  }

  const importSet = new Set<string>()
  const snippets: string[] = []

  for (const block of blocks) {
    const bType = block.type as BlockType
    for (const imp of (IMPORTS[bType] ?? [])) importSet.add(imp)
  }

  // Header
  snippets.push(`# ╔══════════════════════════════════════════════════════════╗
# ║  ModelForge — Generated Pipeline                         ║
# ║  Blocks: ${String(blocks.length).padEnd(2)} · Auto-generated, do not edit manually  ║
# ╚══════════════════════════════════════════════════════════╝
`)

  // Imports block
  snippets.push([...importSet].join('\n'))

  // Per-block snippets
  for (const block of blocks) {
    const p = block.params
    switch (block.type as BlockType) {
      case 'dataset':          snippets.push(genDataset(p)); break
      case 'missing_values':   snippets.push(genMissingValues(p)); break
      case 'scaling':          snippets.push(genScaling(p)); break
      case 'encoding':         snippets.push(genEncoding(p)); break
      case 'outliers':         snippets.push(genOutliers(p)); break
      case 'custom_code':      snippets.push(genCustomCode(p)); break
      case 'evaluate':         snippets.push(genEvaluate()); break
      default:
        if (['random_forest', 'xgboost', 'logistic_regression', 'svm'].includes(block.type)) {
          snippets.push(genModel(block.type as BlockType, p))
        }
    }
  }

  return snippets.join('\n\n')
}
