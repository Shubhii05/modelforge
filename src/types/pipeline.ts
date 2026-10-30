// Core pipeline spec types — single source of truth

export type BlockType =
  | 'dataset'
  | 'missing_values'
  | 'scaling'
  | 'encoding'
  | 'outliers'
  | 'custom_code'
  | 'random_forest'
  | 'xgboost'
  | 'logistic_regression'
  | 'svm'
  | 'evaluate'

export type BlockCategory = 'data' | 'preprocessing' | 'model' | 'output'

export type CustomCodeStatus = 'pending' | 'accepted' | 'rejected' | 'editing'

export interface BlockParams {
  // dataset
  filename?: string
  target_column?: string
  test_size?: number
  stratify?: boolean | string
  // missing values
  strategy?: 'median' | 'mean' | 'most_frequent' | 'constant'
  fill_value?: string
  column?: string
  // scaling
  scaler?: 'standard' | 'minmax' | 'robust'
  method?: string
  // encoding
  encoding?: 'onehot' | 'ordinal' | 'label'
  // outliers
  threshold?: number
  // random forest
  n_estimators?: number
  max_depth?: number
  // xgboost
  learning_rate?: number
  // logistic regression
  C?: number
  penalty?: 'l1' | 'l2' | 'elasticnet'
  // svm
  kernel?: 'rbf' | 'linear' | 'poly'
  gamma?: 'scale' | 'auto'
  // custom code
  code?: string
  custom_code_status?: CustomCodeStatus
}

export interface PipelineBlock {
  id: string
  type: BlockType
  label: string
  params: BlockParams
}

export interface CanvasNode {
  id: string
  position: { x: number; y: number }
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
}

export interface EpochMetric {
  epoch: number
  accuracy: number
  loss: number
}

export interface RunResults {
  runId?: number
  accuracy: number
  precision: number
  f1: number
  loss: number
  epochMetrics: EpochMetric[]
  confusionMatrix: number[][]
}

export interface DataProfile {
  filename: string
  rows: number
  cols: number
  columns: ColumnProfile[]
}

export interface ColumnProfile {
  name: string
  type: 'numeric' | 'categorical' | 'boolean'
  missing_pct: number
  skew?: number
  unique?: number
  imbalance_ratio?: number
}

export interface Suggestion {
  id: string
  blockType: BlockType
  title: string
  description: string
  explanation: string
  accepted: boolean | null // null = unanswered
  fixParams?: Record<string, unknown>
}

export type PipelineSpec = {
  blocks: PipelineBlock[]
}
