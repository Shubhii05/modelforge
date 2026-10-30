import React from 'react'
import { X, LayoutTemplate, Zap, Brain, TrendingUp, Shield, Search } from 'lucide-react'
import { usePipelineStore } from '../../store'
import type { PipelineBlock, CanvasNode, CanvasEdge } from '../../types/pipeline'
import { nanoid } from '../../lib/nanoid'

// ── Template definitions ─────────────────────────────────────────────────────
interface Template {
  id: string
  name: string
  description: string
  tags: string[]
  icon: React.ElementType
  iconColor: string
  blocks: Array<{ type: PipelineBlock['type']; params?: PipelineBlock['params'] }>
}

const TEMPLATES: Template[] = [
  {
    id: 'credit-default',
    name: 'Credit Default Prediction',
    description: 'Binary classification for tabular financial data with missing value handling and feature scaling.',
    tags: ['classification', 'finance', 'tabular'],
    icon: Shield,
    iconColor: 'text-blue-400',
    blocks: [
      { type: 'dataset',       params: { target_column: 'default', test_size: 0.2 } },
      { type: 'missing_values',params: { strategy: 'median' } },
      { type: 'encoding',      params: { encoding: 'onehot' } },
      { type: 'scaling',       params: { scaler: 'standard' } },
      { type: 'xgboost',       params: { n_estimators: 200, max_depth: 6, learning_rate: 0.05 } },
      { type: 'evaluate',      params: {} },
    ],
  },
  {
    id: 'churn',
    name: 'Customer Churn',
    description: 'Predict customer churn with outlier removal, categorical encoding and Random Forest.',
    tags: ['classification', 'business', 'churn'],
    icon: TrendingUp,
    iconColor: 'text-purple-400',
    blocks: [
      { type: 'dataset',       params: { target_column: 'churn', test_size: 0.25 } },
      { type: 'missing_values',params: { strategy: 'most_frequent' } },
      { type: 'encoding',      params: { encoding: 'onehot' } },
      { type: 'outliers',      params: { method: 'iqr', threshold: 1.5 } },
      { type: 'random_forest', params: { n_estimators: 150, max_depth: 12 } },
      { type: 'evaluate',      params: {} },
    ],
  },
  {
    id: 'fast-baseline',
    name: 'Fast Baseline',
    description: 'Minimal pipeline using Logistic Regression — good for establishing a quick performance floor.',
    tags: ['baseline', 'classification', 'fast'],
    icon: Zap,
    iconColor: 'text-yellow-400',
    blocks: [
      { type: 'dataset',            params: { target_column: 'target', test_size: 0.2 } },
      { type: 'missing_values',     params: { strategy: 'mean' } },
      { type: 'scaling',            params: { scaler: 'standard' } },
      { type: 'logistic_regression',params: { C: 1.0, penalty: 'l2' } },
      { type: 'evaluate',           params: {} },
    ],
  },
  {
    id: 'robust-svm',
    name: 'Robust SVM',
    description: 'SVM with RobustScaler and IQR outlier removal — ideal for high-dimensional data with outliers.',
    tags: ['svm', 'classification', 'robust'],
    icon: Brain,
    iconColor: 'text-accent',
    blocks: [
      { type: 'dataset',  params: { target_column: 'label', test_size: 0.2 } },
      { type: 'missing_values', params: { strategy: 'median' } },
      { type: 'outliers', params: { method: 'zscore', threshold: 3 } },
      { type: 'scaling',  params: { scaler: 'robust' } },
      { type: 'svm',      params: { kernel: 'rbf', C: 2.0, gamma: 'scale' } },
      { type: 'evaluate', params: {} },
    ],
  },
]

// ── Template card ────────────────────────────────────────────────────────────
const TemplateCard: React.FC<{ template: Template; onApply: () => void }> = ({
  template, onApply,
}) => {
  const Icon = template.icon
  return (
    <div className="p-4 rounded-lg border border-border bg-surface-hover/40 hover:border-border hover:bg-surface-active/30 transition-colors flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded border border-border bg-surface flex items-center justify-center shrink-0">
          <Icon className={`w-4 h-4 ${template.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white leading-tight">{template.name}</div>
          <p className="text-[11px] text-text-muted leading-relaxed mt-1">{template.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] font-mono px-1.5 py-px rounded bg-surface border border-border text-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="text-[10px] text-text-muted shrink-0 ml-2">
          {template.blocks.length} blocks
        </div>
      </div>

      {/* Block pipeline preview */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {template.blocks.map((b, i) => (
          <React.Fragment key={i}>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted whitespace-nowrap">
              {b.type.replace(/_/g, ' ')}
            </span>
            {i < template.blocks.length - 1 && (
              <span className="text-text-dark text-[10px]">→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      <button
        onClick={onApply}
        className="w-full py-1.5 rounded text-xs font-semibold bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-colors"
      >
        Apply Template
      </button>
    </div>
  )
}

// ── Templates Modal ──────────────────────────────────────────────────────────
interface TemplatesModalProps {
  onClose: () => void
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({ onClose }) => {
  const [query, setQuery] = React.useState('')
  const store = usePipelineStore()

  const filtered = TEMPLATES.filter((t) => {
    const q = query.toLowerCase()
    return (
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q))
    )
  })

  const applyTemplate = (template: Template) => {
    // Build new blocks, nodes, edges from template
    const idMap: Record<number, string> = {}
    const blocks: PipelineBlock[] = template.blocks.map((tb, i) => {
      const id = nanoid()
      idMap[i] = id
      return { id, type: tb.type, label: tb.type.replace(/_/g, ' '), params: tb.params ?? {} }
    })

    const SPACING = 220
    const nodes: CanvasNode[] = blocks.map((b, i) => ({
      id: b.id,
      position: { x: 60 + i * SPACING, y: 200 },
    }))

    const edges: CanvasEdge[] = blocks.slice(0, -1).map((b, i) => ({
      id: `e-${nanoid()}`,
      source: b.id,
      target: blocks[i + 1].id,
    }))

    // Apply to store directly
    usePipelineStore.setState({
      blocks,
      canvasNodes: nodes,
      canvasEdges: edges,
      selectedBlockId: null,
      runResults: null,
      currentEpoch: 0,
      epochMetrics: [],
    })

    store.setProjectName(template.name)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border border-border bg-surface shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="h-12 border-b border-border px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-white">Pipeline Templates</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-active border border-border text-text-muted">
              {TEMPLATES.length} templates
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-text-dark hover:text-text p-1 rounded hover:bg-surface-active transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dark" />
            <input
              type="text"
              placeholder="Search templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder-text-dark focus:outline-none focus:border-accent/60"
              autoFocus
            />
          </div>
        </div>

        {/* Warning */}
        <div className="px-4 py-2 bg-yellow-500/5 border-b border-yellow-500/20 text-[11px] text-yellow-400 shrink-0">
          ⚠ Applying a template will replace your current pipeline.
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8">No templates match "{query}"</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((t) => (
                <TemplateCard key={t.id} template={t} onApply={() => applyTemplate(t)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
