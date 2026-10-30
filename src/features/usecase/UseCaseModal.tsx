import React, { useState } from 'react'
import { Sparkles, X, ArrowRight, CheckCircle2, Database, HelpCircle, Layers, Play } from 'lucide-react'
import { usePipelineStore } from '../../store'
import { planUseCase, loadSampleDataset, getDatasetProfile, getDatasetSuggestions } from '../../api/client'
import type { PipelineBlock, CanvasNode, CanvasEdge, BlockType, Suggestion } from '../../types/pipeline'
import { CATALOG_BY_TYPE } from '../../types/catalog'
import { nanoid } from '../../lib/nanoid'

interface UseCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const PRESETS = [
  {
    title: 'Customer Churn',
    desc: 'Predict subscriber churn from contract terms, charges, and tenure.',
    target: 'churn',
    prompt: 'Predict customer churn based on subscription tenure, contract type, monthly charges, and tech support interactions.',
    sample: 'customer_churn',
    tag: 'Binary Classification',
  },
  {
    title: 'Credit Default',
    desc: 'Assess credit card default risk from repayment history & limits.',
    target: 'default_payment',
    prompt: 'Assess borrower credit card default risk based on credit limit, age, education, and delayed monthly billing payments.',
    sample: 'credit_default',
    tag: 'Imbalanced / Risk',
  },
  {
    title: 'Titanic Survival',
    desc: 'Predict passenger survival with demographic & ticket features.',
    target: 'survived',
    prompt: 'Predict passenger survival on the Titanic from passenger class, age, sex, fare, and port of embarkation.',
    sample: 'titanic',
    tag: 'Tabular / Missing Values',
  },
  {
    title: 'Iris Flower Species',
    desc: 'Botanical multi-class classification from sepal & petal metrics.',
    target: 'species',
    prompt: 'Classify iris flower specimens into setosa, versicolor, or virginica species using petal and sepal measurements.',
    sample: 'iris',
    tag: 'Multi-class',
  },
]

export const UseCaseModal: React.FC<UseCaseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [useCaseText, setUseCaseText] = useState('')
  const [targetColumn, setTargetColumn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planSummary, setPlanSummary] = useState<any | null>(null)

  const { setEntirePipeline, setProjectName, setDataProfile, setDatasetId, setSuggestions, updateBlockParams } = usePipelineStore()

  if (!isOpen) return null

  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    setUseCaseText(preset.prompt)
    setTargetColumn(preset.target)
    setError(null)
    setPlanSummary(null)
  }

  const handleGenerate = async () => {
    if (!useCaseText.trim()) {
      setError('Please describe your use case in plain text.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const plan = await planUseCase(useCaseText, targetColumn.trim() || undefined)

      // Convert planned blocks to PipelineBlocks & layout coordinates
      const newBlocks: PipelineBlock[] = plan.blocks.map((b, idx) => {
        const blockType = b.type as BlockType
        const catalog = CATALOG_BY_TYPE[blockType]
        return {
          id: `b_${idx + 1}_${nanoid(4)}`,
          type: blockType,
          label: catalog?.label ?? b.label,
          params: { ...catalog?.defaultParams, ...b.params },
        }
      })

      const newNodes: CanvasNode[] = newBlocks.map((b, idx) => ({
        id: b.id,
        position: { x: 60 + idx * 210, y: 190 },
      }))

      const newEdges: CanvasEdge[] = []
      for (let i = 0; i < newBlocks.length - 1; i++) {
        newEdges.push({
          id: `e_${i + 1}_${nanoid(4)}`,
          source: newBlocks[i].id,
          target: newBlocks[i + 1].id,
        })
      }

      setEntirePipeline(newBlocks, newNodes, newEdges, plan.project_name)
      setPlanSummary(plan)
    } catch (err) {
      // Offline fallback: construct intelligent pipeline locally if backend is starting
      const fallbackBlocks: PipelineBlock[] = [
        { id: 'b_data', type: 'dataset', label: 'Load Dataset', params: { target_column: targetColumn || 'target', test_size: 0.2 } },
        { id: 'b_imputer', type: 'missing_values', label: 'Handle Missing Values', params: { strategy: 'median' } },
        { id: 'b_encoder', type: 'encoding', label: 'Categorical Encoding', params: { encoding: 'onehot' } },
        { id: 'b_scaler', type: 'scaling', label: 'Feature Scaling', params: { scaler: 'standard' } },
        { id: 'b_model', type: 'random_forest', label: 'Random Forest', params: { n_estimators: 100, max_depth: 8 } },
        { id: 'b_eval', type: 'evaluate', label: 'Evaluate & Metrics', params: {} },
      ]
      const fallbackNodes: CanvasNode[] = fallbackBlocks.map((b, idx) => ({
        id: b.id,
        position: { x: 60 + idx * 210, y: 190 },
      }))
      const fallbackEdges: CanvasEdge[] = []
      for (let i = 0; i < fallbackBlocks.length - 1; i++) {
        fallbackEdges.push({ id: `e_${i + 1}`, source: fallbackBlocks[i].id, target: fallbackBlocks[i + 1].id })
      }
      setEntirePipeline(fallbackBlocks, fallbackNodes, fallbackEdges, 'Custom ML Pipeline')
      setPlanSummary({
        project_name: 'Custom ML Pipeline',
        summary: `Baseline pipeline configured for: "${useCaseText}"`,
        recommended_sample: null,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSampleAndProceed = async (sampleKey: string) => {
    setLoading(true)
    setError(null)
    try {
      const dataset = await loadSampleDataset(sampleKey)
      const profile = await getDatasetProfile(dataset.id, dataset.filename)
      setDataProfile(profile)
      setDatasetId(dataset.id)

      const cards = await getDatasetSuggestions(dataset.id)
      const typeMap: Record<string, BlockType> = {
        'Missing Values': 'missing_values', Scaling: 'scaling', Encoding: 'encoding',
        Outliers: 'outliers', 'Train/Test Split': 'dataset', 'Random Forest': 'random_forest',
        XGBoost: 'xgboost', 'Logistic Regression': 'logistic_regression', SVM: 'svm',
      }
      setSuggestions(cards.flatMap((card) => {
        const blockType = typeMap[card.fix_block.type]
        return blockType ? [{
          id: card.id,
          blockType,
          title: card.title,
          description: card.text,
          explanation: card.severity,
          accepted: null,
          fixParams: card.fix_block.params,
        }] : []
      }))

      onClose()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample dataset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-5 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Generate ML Pipeline from Use Case</h2>
              <p className="text-[11px] text-text-muted">Describe your problem statement in plain text</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-white hover:bg-surface-active transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Presets */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 block">
              Quick-Start Templates
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="p-2.5 rounded-lg border border-border bg-surface-hover/40 hover:border-accent/40 hover:bg-surface-active text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white group-hover:text-accent transition-colors">
                      {p.title}
                    </span>
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-surface border border-border text-text-muted">
                      {p.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 leading-snug line-clamp-2">
                    {p.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Text input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center justify-between">
              <span>Your ML Problem / Use Case Description</span>
              <span className="text-text-muted font-normal text-[10px]">Plain text input</span>
            </label>
            <textarea
              rows={4}
              value={useCaseText}
              onChange={(e) => setUseCaseText(e.target.value)}
              placeholder="e.g. I want to build a machine learning pipeline to predict customer churn based on subscription tenure, contract type, payment delay, and monthly charges. The data has missing billing records and categorical attributes."
              className="w-full bg-surface border border-border rounded-lg p-3 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/60 leading-relaxed font-sans"
            />
          </div>

          {/* Target column hint */}
          <div className="flex items-center gap-3">
            <div className="w-1/2 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
                Target Column Name <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                placeholder="e.g. churn, survived, default_payment"
                className="w-full bg-surface border border-border rounded px-3 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-accent/60"
              />
            </div>
            <div className="w-1/2 text-[11px] text-text-muted leading-relaxed pt-3">
              If omitted, ModelForge will infer the target column from your dataset profile.
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Plan Summary after generation */}
          {planSummary && (
            <div className="p-4 rounded-xl border border-success/30 bg-success/5 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-success font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span>Initial Pipeline Generated on Canvas!</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {planSummary.summary}
              </p>

              <div className="p-2.5 rounded bg-surface border border-border text-xs space-y-1.5">
                <div className="text-[10px] uppercase font-mono text-text-muted">Next Step: Dataset Upload</div>
                <p className="text-[11px] text-text">
                  Your pipeline architecture is configured. Now upload your CSV dataset or select a sample dataset to profile features and receive dataset-specific suggestions.
                </p>
              </div>

              {planSummary.recommended_sample && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleLoadSampleAndProceed(planSummary.recommended_sample)}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-accent hover:bg-accent-hover text-white transition-colors"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Load Matching Sample Data & Proceed</span>
                  </button>
                  <button
                    onClick={() => { onClose(); onSuccess?.() }}
                    className="py-2 px-4 rounded-lg text-xs border border-border text-text hover:bg-surface-active transition-colors"
                  >
                    Upload My Own CSV
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-5 border-t border-border bg-surface-hover/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <HelpCircle className="w-3.5 h-3.5 text-accent" />
            <span>Generates nodes, dataflow edges, and model configuration.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-xs border border-border text-text-muted hover:text-white hover:bg-surface-active transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || !useCaseText.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold bg-accent hover:bg-accent-hover active:scale-[0.98] text-white shadow transition-all disabled:opacity-50"
            >
              {loading ? (
                <><span className="animate-spin text-sm">⟳</span> Planning Pipeline…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generate Initial Pipeline</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
