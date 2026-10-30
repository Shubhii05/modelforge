import React from 'react'
import { usePipelineStore } from '../../store'
import { CATALOG_BY_TYPE } from '../../types/catalog'
import type { BlockType, BlockParams } from '../../types/pipeline'

interface SliderFieldProps {
  label: string
  paramKey: keyof BlockParams
  value: number
  min: number
  max: number
  step: number
  blockId: string
}

const SliderField: React.FC<SliderFieldProps> = ({ label, paramKey, value, min, max, step, blockId }) => {
  const { updateBlockParams } = usePipelineStore()
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted">{label}</span>
        <span className="font-mono text-accent">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) =>
          updateBlockParams(blockId, { [paramKey]: step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10) })
        }
        className="w-full h-1 rounded appearance-none cursor-pointer accent-accent bg-surface-active"
      />
    </div>
  )
}

interface SelectFieldProps {
  label: string
  paramKey: keyof BlockParams
  value: string
  options: { value: string; label: string }[]
  blockId: string
}

const SelectField: React.FC<SelectFieldProps> = ({ label, paramKey, value, options, blockId }) => {
  const { updateBlockParams } = usePipelineStore()
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => updateBlockParams(blockId, { [paramKey]: e.target.value })}
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

const WHY: Record<BlockType, string> = {
  dataset: 'An 80/20 train-test split is the standard default — enough test data for reliable metrics without wasting training samples.',
  missing_values: 'Median imputation is robust to outliers and keeps the distribution shape better than mean on skewed features.',
  scaling: 'StandardScaler (z-score) is safe for most models; switch to MinMax if your model expects bounded inputs like neural nets.',
  encoding: 'One-hot encoding avoids implying ordinal relationships between categories that don\'t have natural ordering.',
  outliers: 'IQR at 1.5× is the Tukey fence — a well-tested heuristic that removes extreme values without being too aggressive.',
  custom_code: 'Custom transformers integrate seamlessly via scikit-learn\'s Pipeline API and benefit from fit/transform separation.',
  random_forest: '100 trees stabilises the variance-bias tradeoff; max_depth=10 prevents overfitting on moderate datasets.',
  xgboost: 'Learning rate 0.1 with 100 rounds is a solid starting point; lower lr + more rounds gives better generalisation.',
  logistic_regression: 'C=1.0 (moderate regularisation) with L2 penalty is a strong, converging default for binary classification.',
  svm: 'RBF kernel with scale gamma adapts to feature variance automatically — best for unknown non-linear boundaries.',
  evaluate: 'Accuracy + F1 + confusion matrix together reveal both overall and per-class performance.',
}

export const ConfigPanel: React.FC = () => {
  const { blocks, selectedBlockId, transparencyMode } = usePipelineStore()
  const block = blocks.find((b) => b.id === selectedBlockId)

  if (!block) {
    return (
      <div className="p-4 text-xs text-text-muted italic">
        Click a block on the canvas to configure its parameters.
      </div>
    )
  }

  const catalog = CATALOG_BY_TYPE[block.type as BlockType]
  const p = block.params

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white">{block.label}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-active border border-border text-text-muted capitalize">
          {catalog.category}
        </span>
      </div>

      {transparencyMode && (
        <div className="p-2.5 rounded bg-surface border border-accent/20 text-[11px] text-accent/80 italic leading-relaxed">
          💡 {WHY[block.type as BlockType]}
        </div>
      )}

      <div className="space-y-3">
        {/* ── Dataset ─────────────────── */}
        {block.type === 'dataset' && (
          <>
            <div>
              <label className="text-xs text-text-muted block mb-1">Target column</label>
              <input
                type="text"
                value={p.target_column ?? 'target'}
                onChange={(e) => usePipelineStore.getState().updateBlockParams(block.id, { target_column: e.target.value })}
                className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent/60 font-mono"
              />
            </div>
            <SliderField label="Test split" paramKey="test_size" value={p.test_size ?? 0.2} min={0.05} max={0.5} step={0.05} blockId={block.id} />
          </>
        )}

        {/* ── Missing Values ───────────── */}
        {block.type === 'missing_values' && (
          <SelectField
            label="Imputation strategy"
            paramKey="strategy"
            value={p.strategy ?? 'median'}
            options={[
              { value: 'median', label: 'Median' },
              { value: 'mean', label: 'Mean' },
              { value: 'most_frequent', label: 'Most Frequent' },
              { value: 'constant', label: 'Constant' },
            ]}
            blockId={block.id}
          />
        )}

        {/* ── Scaling ─────────────────── */}
        {block.type === 'scaling' && (
          <SelectField
            label="Scaler"
            paramKey="scaler"
            value={p.scaler ?? 'standard'}
            options={[
              { value: 'standard', label: 'StandardScaler' },
              { value: 'minmax', label: 'MinMaxScaler' },
              { value: 'robust', label: 'RobustScaler' },
            ]}
            blockId={block.id}
          />
        )}

        {/* ── Encoding ────────────────── */}
        {block.type === 'encoding' && (
          <SelectField
            label="Encoding method"
            paramKey="encoding"
            value={p.encoding ?? 'onehot'}
            options={[
              { value: 'onehot', label: 'One-Hot' },
              { value: 'ordinal', label: 'Ordinal' },
              { value: 'label', label: 'Label' },
            ]}
            blockId={block.id}
          />
        )}

        {/* ── Outliers ────────────────── */}
        {block.type === 'outliers' && (
          <>
            <SelectField
              label="Detection method"
              paramKey="method"
              value={p.method ?? 'iqr'}
              options={[
                { value: 'iqr', label: 'IQR (Tukey fence)' },
                { value: 'zscore', label: 'Z-Score' },
              ]}
              blockId={block.id}
            />
            <SliderField label="Threshold" paramKey="threshold" value={p.threshold ?? 1.5} min={0.5} max={4} step={0.5} blockId={block.id} />
          </>
        )}

        {/* ── Random Forest ────────────── */}
        {block.type === 'random_forest' && (
          <>
            <SliderField label="n_estimators" paramKey="n_estimators" value={p.n_estimators ?? 100} min={10} max={500} step={10} blockId={block.id} />
            <SliderField label="max_depth" paramKey="max_depth" value={p.max_depth ?? 10} min={1} max={30} step={1} blockId={block.id} />
          </>
        )}

        {/* ── XGBoost ─────────────────── */}
        {block.type === 'xgboost' && (
          <>
            <SliderField label="n_estimators" paramKey="n_estimators" value={p.n_estimators ?? 100} min={10} max={500} step={10} blockId={block.id} />
            <SliderField label="max_depth" paramKey="max_depth" value={p.max_depth ?? 6} min={1} max={15} step={1} blockId={block.id} />
            <SliderField label="learning_rate" paramKey="learning_rate" value={p.learning_rate ?? 0.1} min={0.01} max={0.5} step={0.01} blockId={block.id} />
          </>
        )}

        {/* ── Logistic Regression ──────── */}
        {block.type === 'logistic_regression' && (
          <>
            <SliderField label="C (regularisation)" paramKey="C" value={p.C ?? 1.0} min={0.01} max={10} step={0.01} blockId={block.id} />
            <SelectField
              label="Penalty"
              paramKey="penalty"
              value={p.penalty ?? 'l2'}
              options={[
                { value: 'l2', label: 'L2 (Ridge)' },
                { value: 'l1', label: 'L1 (Lasso)' },
              ]}
              blockId={block.id}
            />
          </>
        )}

        {/* ── SVM ─────────────────────── */}
        {block.type === 'svm' && (
          <>
            <SelectField
              label="Kernel"
              paramKey="kernel"
              value={p.kernel ?? 'rbf'}
              options={[
                { value: 'rbf', label: 'RBF' },
                { value: 'linear', label: 'Linear' },
                { value: 'poly', label: 'Polynomial' },
              ]}
              blockId={block.id}
            />
            <SliderField label="C (margin)" paramKey="C" value={p.C ?? 1.0} min={0.01} max={10} step={0.01} blockId={block.id} />
          </>
        )}

        {/* ── Evaluate / Custom ────────── */}
        {(block.type === 'evaluate' || block.type === 'custom_code') && (
          <p className="text-xs text-text-muted italic">No configurable parameters for this block.</p>
        )}
      </div>
    </div>
  )
}
