import type { BlockType, BlockCategory, BlockParams } from './pipeline'

export interface BlockCatalogEntry {
  type: BlockType
  label: string
  category: BlockCategory
  description: string
  defaultParams: BlockParams
  isAI?: boolean
}

export const BLOCK_CATALOG: BlockCatalogEntry[] = [
  {
    type: 'dataset',
    label: 'Load Dataset',
    category: 'data',
    description: 'Upload CSV or sample tabular dataset with auto-profiling',
    defaultParams: { target_column: 'target', test_size: 0.2 },
  },
  {
    type: 'missing_values',
    label: 'Handle Missing Values',
    category: 'preprocessing',
    description: 'Impute missing data with median, mean, or constant fill',
    defaultParams: { strategy: 'median' },
  },
  {
    type: 'scaling',
    label: 'Feature Scaling',
    category: 'preprocessing',
    description: 'Normalize or standardize numerical feature ranges',
    defaultParams: { scaler: 'standard' },
  },
  {
    type: 'encoding',
    label: 'Encode Categorical',
    category: 'preprocessing',
    description: 'One-hot or ordinal encoding for categorical columns',
    defaultParams: { encoding: 'onehot' },
  },
  {
    type: 'outliers',
    label: 'Outlier Removal',
    category: 'preprocessing',
    description: 'Remove outliers via IQR or Z-Score threshold',
    defaultParams: { method: 'iqr', threshold: 1.5 },
  },
  {
    type: 'custom_code',
    label: 'Custom Code',
    category: 'preprocessing',
    description: 'AI-assisted scikit-learn transformer block',
    defaultParams: { code: '# Custom sklearn-compatible transformer\n', custom_code_status: 'pending' },
    isAI: true,
  },
  {
    type: 'random_forest',
    label: 'Random Forest',
    category: 'model',
    description: 'Ensemble bagging classifier for tabular data',
    defaultParams: { n_estimators: 100, max_depth: 10 },
  },
  {
    type: 'xgboost',
    label: 'XGBoost',
    category: 'model',
    description: 'Gradient boosted decision trees for high performance',
    defaultParams: { n_estimators: 100, max_depth: 6, learning_rate: 0.1 },
  },
  {
    type: 'logistic_regression',
    label: 'Logistic Regression',
    category: 'model',
    description: 'Linear decision boundary — fast baseline for binary tasks',
    defaultParams: { C: 1.0, penalty: 'l2' },
  },
  {
    type: 'svm',
    label: 'SVM',
    category: 'model',
    description: 'Effective in high-dimensional feature spaces',
    defaultParams: { kernel: 'rbf', C: 1.0, gamma: 'scale' },
  },
  {
    type: 'evaluate',
    label: 'Evaluate & Metrics',
    category: 'output',
    description: 'Accuracy, confusion matrix, F1 and loss reporting',
    defaultParams: {},
  },
]

export const CATALOG_BY_TYPE = Object.fromEntries(
  BLOCK_CATALOG.map((b) => [b.type, b])
) as Record<BlockType, BlockCatalogEntry>
