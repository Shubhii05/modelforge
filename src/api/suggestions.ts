import type { DataProfile, Suggestion, BlockType } from '../types/pipeline'
import { nanoid } from '../lib/nanoid'

export interface SuggestionService {
  generateSuggestions(profile: DataProfile): Suggestion[]
}

interface Rule {
  check: (profile: DataProfile) => boolean
  suggestion: Omit<Suggestion, 'id' | 'accepted'>
}

const RULES: Rule[] = [
  {
    check: (p) => p.columns.some((c) => c.missing_pct > 5),
    suggestion: {
      blockType: 'missing_values' as BlockType,
      title: 'Missing values detected',
      description: 'Some columns have over 5% missing data. Add a Missing Values handler before training.',
      explanation: 'Models like Random Forest can\'t train on NaN values. Imputing with the median preserves the feature\'s distribution and is robust to outliers.',
    },
  },
  {
    check: (p) => p.columns.some((c) => c.type === 'numeric' && Math.abs(c.skew ?? 0) > 1.5),
    suggestion: {
      blockType: 'scaling' as BlockType,
      title: 'High feature skew detected',
      description: 'One or more numeric columns are heavily skewed (|skew| > 1.5). Scaling will help distance-based models.',
      explanation: 'Skewed features create uneven gradients that hurt SVM and logistic regression. StandardScaler or RobustScaler brings them to a common scale.',
    },
  },
  {
    check: (p) => p.columns.some((c) => c.type === 'categorical' && (c.unique ?? 0) > 2),
    suggestion: {
      blockType: 'encoding' as BlockType,
      title: 'Categorical columns need encoding',
      description: 'Text categories found — models require numeric input. Add an Encode Categorical block.',
      explanation: 'Tree models can sometimes handle raw categories, but sklearn\'s API requires numeric arrays. One-hot encoding avoids implying false ordinal relationships.',
    },
  },
  {
    check: (p) => {
      const target = p.columns.find((c) => c.name.toLowerCase() === 'target' || c.name.toLowerCase() === 'label' || c.name.toLowerCase() === 'y')
      return !!(target && (target.imbalance_ratio ?? 1) > 3)
    },
    suggestion: {
      blockType: 'random_forest' as BlockType,
      title: 'Class imbalance detected in target',
      description: 'The target column appears imbalanced (ratio > 3:1). Consider Random Forest with class_weight="balanced".',
      explanation: 'Imbalanced classes cause models to predict the majority class and ignore the minority. Balanced weighting penalises majority-class errors more heavily.',
    },
  },
  {
    check: (p) => p.columns.some((c) => c.type === 'numeric' && (c.missing_pct ?? 0) === 0 && Math.abs(c.skew ?? 0) > 3),
    suggestion: {
      blockType: 'outliers' as BlockType,
      title: 'Extreme outliers likely present',
      description: 'Very high skew (|skew| > 3) suggests extreme outlier values. An Outlier Removal block may improve model stability.',
      explanation: 'Extreme values pull the model\'s learned boundaries and inflate variance. IQR-based removal keeps 99.3% of a normal distribution while clipping anomalies.',
    },
  },
  {
    check: (p) => p.cols > 50,
    suggestion: {
      blockType: 'custom_code' as BlockType,
      title: 'High-dimensional dataset',
      description: 'High-dimensional dataset detected. A custom PCA or feature selection step may reduce noise and speed up training.',
      explanation: 'High dimensionality causes the "curse of dimensionality" — distances become uniform and models overfit. PCA or SelectKBest can compress without losing signal.',
    },
  },
]

export const mockSuggestionService: SuggestionService = {
  generateSuggestions(profile: DataProfile): Suggestion[] {
    return RULES
      .filter((rule) => rule.check(profile))
      .map((rule) => ({ id: nanoid(), accepted: null, ...rule.suggestion }))
  },
}
