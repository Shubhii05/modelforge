import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Play, Sparkles, RotateCcw, AlertTriangle, Wand2, CheckCircle2 } from 'lucide-react'
import { usePipelineStore } from '../../store'
import { predictModel, fetchModelInfo } from '../../api/client'
import type { ClassProbability } from '../../api/client'

// ── Feature row ─────────────────────────────────────────────────────────────
const FeatureRow: React.FC<{
  name: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}> = ({ name, value, placeholder, onChange }) => (
  <div className="flex items-center gap-2">
    <label className="text-[11px] text-text-muted font-mono w-28 truncate shrink-0" title={name}>
      {name}
    </label>
    <input
      type="text"
      value={value}
      placeholder={placeholder ?? '0'}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-text font-mono focus:outline-none focus:border-accent/60 placeholder:text-text-muted/40"
    />
  </div>
)

// ── Result Display ──────────────────────────────────────────────────────────
interface PredResult {
  label: string
  confidence: number
  probabilities: ClassProbability[]
}

const ResultDisplay: React.FC<{ result: PredResult }> = ({ result }) => {
  const isPos = String(result.label).toLowerCase() === '1' || String(result.label).toLowerCase() === 'yes' || String(result.label).toLowerCase() === 'true'

  return (
    <div className={`p-3.5 rounded-lg border text-center space-y-3 ${
      isPos ? 'border-amber-500/30 bg-amber-500/5' : 'border-success/30 bg-success/5'
    }`}>
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wide text-text-muted">
        <span>Inference Result</span>
        <span className="flex items-center gap-1 text-success">
          <CheckCircle2 className="w-3 h-3" /> Real Model
        </span>
      </div>

      <div>
        <div className="text-[10px] text-text-muted uppercase">Predicted Class</div>
        <div className={`text-2xl font-mono font-bold mt-0.5 ${isPos ? 'text-amber-400' : 'text-success'}`}>
          {String(result.label)}
        </div>
      </div>

      <div className="text-xs text-text-muted">
        Top Confidence: <span className="font-mono text-white font-semibold">{(result.confidence * 100).toFixed(1)}%</span>
      </div>

      {/* Probabilities list */}
      {result.probabilities.length > 0 && (
        <div className="space-y-1.5 text-left pt-2 border-t border-border/50">
          <div className="text-[10px] uppercase font-mono text-text-muted mb-1">Class Probabilities</div>
          {result.probabilities.map((prob) => {
            const pct = Math.round(prob.probability * 1000) / 10
            return (
              <div key={String(prob.label)} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                  <span className="truncate max-w-[140px] text-text font-medium">{String(prob.label)}</span>
                  <span>{pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-active overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      String(prob.label) === String(result.label) ? 'bg-accent' : 'bg-surface-hover'
                    }`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Playground Panel ────────────────────────────────────────────────────────
export const PlaygroundPanel: React.FC = () => {
  const { runResults, blocks, dataProfile } = usePipelineStore()
  const [modelFeatures, setModelFeatures] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PredResult | null>(null)
  const [predicting, setPredicting] = useState(false)
  const [predError, setPredError] = useState<string | null>(null)

  const hasModel = blocks.some((b) =>
    ['random_forest', 'xgboost', 'logistic_regression', 'svm'].includes(b.type)
  )

  // Fetch actual model feature names from backend run artifact if available
  useEffect(() => {
    let active = true
    if (runResults?.runId) {
      fetchModelInfo(runResults.runId)
        .then((info) => {
          if (active && info.feature_names && info.feature_names.length > 0) {
            setModelFeatures(info.feature_names)
          }
        })
        .catch(() => {
          // Fallback to dataProfile columns
        })
    }
    return () => {
      active = false
    }
  }, [runResults?.runId])

  // Derive feature names
  const featureNames = useMemo<string[]>(() => {
    if (modelFeatures.length > 0) return modelFeatures
    if (dataProfile && dataProfile.columns.length > 0) {
      const targetBlock = blocks.find((b) => b.type === 'dataset')
      const target = String(targetBlock?.params.target_column ?? dataProfile.columns[dataProfile.columns.length - 1].name)
      return dataProfile.columns.filter((c) => c.name !== target).map((c) => c.name)
    }
    return ['feature_1', 'feature_2', 'feature_3', 'feature_4']
  }, [modelFeatures, dataProfile, blocks])

  // Initialize values when featureNames change
  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev }
      for (const name of featureNames) {
        if (next[name] === undefined) {
          next[name] = ''
        }
      }
      return next
    })
  }, [featureNames])

  // Quick fill with sensible sample values from data profile
  const handleFillSample = useCallback(() => {
    const next: Record<string, string> = {}
    for (const name of featureNames) {
      const col = dataProfile?.columns.find((c) => c.name === name)
      if (col?.type === 'numeric') {
        next[name] = String(Math.round((col.skew ?? 1.0) * 10 + 25))
      } else if (col?.type === 'boolean') {
        next[name] = '1'
      } else {
        next[name] = 'Sample'
      }
    }
    setValues(next)
    setPredError(null)
  }, [featureNames, dataProfile])

  // REAL inference via backend API
  const handlePredict = async () => {
    if (!runResults?.runId) {
      setPredError('Please train the model first by clicking "Run Pipeline".')
      return
    }

    setPredicting(true)
    setPredError(null)
    setResult(null)

    try {
      const payloadRow: Record<string, unknown> = {}
      for (const name of featureNames) {
        const raw = values[name] ?? ''
        const trimmed = String(raw).trim()
        if (trimmed === '') {
          payloadRow[name] = 0 // Default neutral value
        } else if (!isNaN(Number(trimmed))) {
          payloadRow[name] = Number(trimmed)
        } else {
          payloadRow[name] = trimmed
        }
      }

      const response = await predictModel(runResults.runId, [payloadRow])
      const first = response.predictions[0]

      if (first) {
        const topProb = first.probabilities?.length > 0
          ? Math.max(...first.probabilities.map((p) => p.probability))
          : 1.0

        setResult({
          label: String(first.label),
          confidence: topProb,
          probabilities: first.probabilities ?? [],
        })
      }
    } catch (err) {
      setPredError(err instanceof Error ? err.message : 'Inference request failed')
    } finally {
      setPredicting(false)
    }
  }

  const handleReset = () => {
    setValues(Object.fromEntries(featureNames.map((n) => [n, ''])))
    setResult(null)
    setPredError(null)
  }

  if (!hasModel) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-text-muted" />
          Live Model Predictions
        </div>
        <div className="flex items-start gap-2 p-3 rounded border border-yellow-500/20 bg-yellow-500/5 text-xs text-yellow-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Add a model block (Random Forest, XGBoost, etc.) to use the playground.</span>
        </div>
      </div>
    )
  }

  if (!runResults || !runResults.runId) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-text-muted" />
          Live Model Predictions
        </div>
        <div className="p-3.5 rounded border border-border bg-surface-hover/30 text-xs space-y-2">
          <div className="flex items-center gap-2 text-text font-medium">
            <Play className="w-3.5 h-3.5 text-accent" />
            <span>Model not trained yet</span>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Click <span className="font-semibold text-white">Run Pipeline</span> in the top bar to fit the model with real weights on your dataset. Once trained, you can test live predictions right here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          Live Model Predictions
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/15 border border-success/30 text-success">
          Run #{runResults.runId} active
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-text-muted">
          Input features for actual scikit-learn inference:
        </p>
        <button
          onClick={handleFillSample}
          className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover font-medium border border-accent/20 rounded px-1.5 py-0.5"
          title="Autofill feature values"
        >
          <Wand2 className="w-2.5 h-2.5" /> Autofill
        </button>
      </div>

      {predError && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          {predError}
        </div>
      )}

      {/* Feature inputs */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handlePredict}
          disabled={predicting}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold bg-accent hover:bg-accent-hover active:scale-[0.98] text-white transition-all disabled:opacity-50"
        >
          {predicting ? (
            <><span className="animate-spin text-sm">⟳</span> Running Model…</>
          ) : (
            <><Play className="w-3 h-3 fill-current" /> Run Live Prediction</>
          )}
        </button>
        <button
          onClick={handleReset}
          title="Reset values"
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
