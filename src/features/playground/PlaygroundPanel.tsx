import React, { useState } from 'react'
import { Play, Sparkles, RotateCcw, AlertTriangle } from 'lucide-react'
import { usePipelineStore } from '../../store'

// ── Seeded RNG ───────────────────────────────────────────────────────────────
function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

// ── A single feature input row ───────────────────────────────────────────────
const FeatureRow: React.FC<{
  name: string
  value: string
  onChange: (v: string) => void
}> = ({ name, value, onChange }) => (
  <div className="flex items-center gap-2">
    <label className="text-[11px] text-text-muted font-mono w-28 truncate shrink-0">{name}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-text font-mono focus:outline-none focus:border-accent/60"
    />
  </div>
)

// ── Predict button result display ────────────────────────────────────────────
interface PredResult {
  label: string
  confidence: number
  probPos: number
  probNeg: number
}

const ResultDisplay: React.FC<{ result: PredResult }> = ({ result }) => {
  const isPositive = result.label === '1' || result.label === 'Yes' || result.label === 'True'
  return (
    <div className={`p-3 rounded-lg border text-center space-y-2 ${
      isPositive
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-success/30 bg-success/5'
    }`}>
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wide">Prediction</div>
      <div className={`text-2xl font-mono font-bold ${isPositive ? 'text-red-400' : 'text-success'}`}>
        {result.label}
      </div>
      <div className="text-xs text-text-muted">
        Confidence: <span className="font-mono text-white">{(result.confidence * 100).toFixed(1)}%</span>
      </div>
      {/* Probability bar */}
      <div className="space-y-1 text-left">
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>P(0)</span>
          <span className="font-mono">{(result.probNeg * 100).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-active overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all"
            style={{ width: `${result.probNeg * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>P(1)</span>
          <span className="font-mono">{(result.probPos * 100).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-active overflow-hidden">
          <div
            className="h-full bg-red-400 rounded-full transition-all"
            style={{ width: `${result.probPos * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Playground Panel ──────────────────────────────────────────────────────────
export const PlaygroundPanel: React.FC = () => {
  const { runResults, blocks, dataProfile } = usePipelineStore()

  // Derive feature names from data profile or use placeholders
  const featureNames: string[] = React.useMemo(() => {
    if (dataProfile && dataProfile.columns.length > 0) {
      const target = dataProfile.columns[dataProfile.columns.length - 1].name
      return dataProfile.columns
        .filter((c) => c.name !== target)
        .slice(0, 8)
        .map((c) => c.name)
    }
    return ['feature_1', 'feature_2', 'feature_3', 'feature_4', 'age', 'income', 'balance']
  }, [dataProfile])

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(featureNames.map((n) => [n, '']))
  )
  const [result, setResult] = useState<PredResult | null>(null)
  const [predicting, setPredicting] = useState(false)

  const hasModel = blocks.some((b) =>
    ['random_forest', 'xgboost', 'logistic_regression', 'svm'].includes(b.type)
  )

  const handlePredict = () => {
    if (!runResults) return
    setPredicting(true)
    setResult(null)

    // Simulate inference delay
    setTimeout(() => {
      // Deterministic mock — hash the input values
      const inputStr = featureNames.map((n) => values[n] ?? '0').join(',')
      const h = hash(inputStr + blocks.map((b) => b.id).join(''))

      // Bias toward model's accuracy
      const acc = runResults.accuracy
      const probPos = Math.max(0.01, Math.min(0.99, h * 0.6 + (1 - acc) * 0.2))
      const probNeg = 1 - probPos
      const label = probPos > 0.5 ? '1' : '0'
      const confidence = label === '1' ? probPos : probNeg

      setResult({ label, confidence, probPos, probNeg })
      setPredicting(false)
    }, 600)
  }

  const handleReset = () => {
    setValues(Object.fromEntries(featureNames.map((n) => [n, ''])))
    setResult(null)
  }

  if (!hasModel) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-text-muted" />
          Live Predictions
        </div>
        <div className="flex items-start gap-2 p-3 rounded border border-yellow-500/20 bg-yellow-500/5 text-xs text-yellow-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Add a model block (Random Forest, XGBoost, etc.) to use the playground.</span>
        </div>
      </div>
    )
  }

  if (!runResults) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-text-muted" />
          Live Predictions
        </div>
        <div className="flex items-start gap-2 p-3 rounded border border-border bg-surface-hover/30 text-xs text-text-muted">
          <Play className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Run the pipeline first to enable the inference playground.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          Live Predictions
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/15 border border-success/30 text-success">
          Model ready
        </span>
      </div>

      <p className="text-[11px] text-text-muted leading-relaxed">
        Enter feature values and click <span className="text-accent font-mono">Predict</span> to run inference on the trained model.
      </p>

      {/* Feature inputs */}
      <div className="space-y-2">
        {featureNames.map((name) => (
          <FeatureRow
            key={name}
            name={name}
            value={values[name] ?? ''}
            onChange={(v) => setValues((prev) => ({ ...prev, [name]: v }))}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePredict}
          disabled={predicting}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
        >
          {predicting ? (
            <><span className="animate-spin text-sm">⟳</span> Predicting…</>
          ) : (
            <><Play className="w-3 h-3 fill-current" /> Predict</>
          )}
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded text-xs border border-border text-text-muted hover:text-text hover:bg-surface-active transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Result */}
      {result && <ResultDisplay result={result} />}
    </div>
  )
}
