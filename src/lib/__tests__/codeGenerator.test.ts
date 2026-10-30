import { describe, it, expect } from 'vitest'
import { generateCode } from '../codeGenerator'
import type { PipelineBlock } from '../../types/pipeline'

const block = (type: PipelineBlock['type'], params: PipelineBlock['params'] = {}): PipelineBlock => ({
  id: 'test-' + type,
  type,
  label: type,
  params,
})

describe('generateCode', () => {
  it('returns placeholder for empty spec', () => {
    expect(generateCode([])).toContain('Add blocks')
  })

  it('emits correct pandas import for dataset block', () => {
    const code = generateCode([block('dataset', { target_column: 'label', test_size: 0.25 })])
    expect(code).toContain('import pandas as pd')
    expect(code).toContain('train_test_split')
    expect(code).toContain('"label"')
    expect(code).toContain('test_size=0.25')
  })

  it('emits median imputer by default', () => {
    const code = generateCode([block('missing_values')])
    expect(code).toContain('SimpleImputer(strategy="median")')
  })

  it('emits constant imputer with fill_value when strategy=constant', () => {
    const code = generateCode([block('missing_values', { strategy: 'constant', fill_value: '-1' })])
    expect(code).toContain('strategy="constant"')
    expect(code).toContain('fill_value="-1"')
  })

  it('emits StandardScaler for default scaling', () => {
    const code = generateCode([block('scaling')])
    expect(code).toContain('StandardScaler()')
  })

  it('emits MinMaxScaler when scaler=minmax', () => {
    const code = generateCode([block('scaling', { scaler: 'minmax' })])
    expect(code).toContain('MinMaxScaler()')
  })

  it('emits OneHotEncoder for default encoding', () => {
    const code = generateCode([block('encoding')])
    expect(code).toContain('OneHotEncoder')
  })

  it('emits IQR outlier code by default', () => {
    const code = generateCode([block('outliers')])
    expect(code).toContain('np.percentile')
    expect(code).toContain('1.5')
  })

  it('emits zscore outlier code when method=zscore', () => {
    const code = generateCode([block('outliers', { method: 'zscore', threshold: 3 })])
    expect(code).toContain('zscore')
    expect(code).toContain('< 3')
  })

  it('emits RandomForestClassifier with correct params', () => {
    const code = generateCode([block('random_forest', { n_estimators: 200, max_depth: 5 })])
    expect(code).toContain('RandomForestClassifier')
    expect(code).toContain('n_estimators=200')
    expect(code).toContain('max_depth=5')
  })

  it('emits XGBClassifier with learning_rate', () => {
    const code = generateCode([block('xgboost', { learning_rate: 0.05, n_estimators: 150 })])
    expect(code).toContain('XGBClassifier')
    expect(code).toContain('learning_rate=0.05')
    expect(code).toContain('n_estimators=150')
  })

  it('emits LogisticRegression with C and penalty', () => {
    const code = generateCode([block('logistic_regression', { C: 0.5, penalty: 'l1' })])
    expect(code).toContain('LogisticRegression')
    expect(code).toContain('C=0.5')
    expect(code).toContain('penalty="l1"')
  })

  it('emits SVC with kernel and C', () => {
    const code = generateCode([block('svm', { kernel: 'linear', C: 2.0 })])
    expect(code).toContain('SVC')
    expect(code).toContain('kernel="linear"')
    expect(code).toContain('C=2')
  })

  it('emits evaluation metrics for evaluate block', () => {
    const code = generateCode([block('evaluate')])
    expect(code).toContain('accuracy_score')
    expect(code).toContain('confusion_matrix')
    expect(code).toContain('log_loss')
  })

  it('emits pending warning for unreviewed custom_code block', () => {
    const code = generateCode([block('custom_code', { code: '# my code', custom_code_status: 'pending' })])
    expect(code).toContain('awaiting review')
    expect(code).toContain('# my code')
  })

  it('emits accepted marker for accepted custom_code block', () => {
    const code = generateCode([block('custom_code', { code: '# ok', custom_code_status: 'accepted' })])
    expect(code).toContain('accepted by user')
  })

  it('deduplicates imports across multiple blocks', () => {
    const code = generateCode([
      block('missing_values'),
      block('missing_values'),
    ])
    const matches = code.match(/from sklearn.impute import SimpleImputer/g)
    expect(matches?.length).toBe(1)
  })

  it('full pipeline emits all sections in order', () => {
    const code = generateCode([
      block('dataset', { target_column: 'y' }),
      block('missing_values'),
      block('scaling'),
      block('random_forest'),
      block('evaluate'),
    ])
    const datasetIdx = code.indexOf('Load Dataset')
    const scaleIdx   = code.indexOf('Feature Scaling')
    const modelIdx   = code.indexOf('Train: Random Forest')
    const evalIdx    = code.indexOf('Evaluate')
    expect(datasetIdx).toBeLessThan(scaleIdx)
    expect(scaleIdx).toBeLessThan(modelIdx)
    expect(modelIdx).toBeLessThan(evalIdx)
  })
})
