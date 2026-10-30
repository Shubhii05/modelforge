import React, { useCallback, useState } from 'react'
import { Upload, FileText, CheckCircle, AlertTriangle, TrendingUp, Hash, Sparkles } from 'lucide-react'
import { usePipelineStore } from '../../store'
import { getDatasetProfile, getDatasetSuggestions, uploadDataset, loadSampleDataset } from '../../api/client'
import type { Suggestion } from '../../types/pipeline'
import type { ColumnProfile } from '../../types/pipeline'

const TypeBadge: React.FC<{ type: ColumnProfile['type'] }> = ({ type }) => {
  const cls =
    type === 'numeric' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    : type === 'categorical' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
    : 'bg-green-500/15 text-green-400 border-green-500/30'
  return (
    <span className={`text-[9px] font-mono px-1 py-px rounded border ${cls}`}>{type}</span>
  )
}

const SAMPLE_DATASETS = [
  { key: 'iris', name: 'Iris Classification', rows: 150, cols: 5, target: 'species', tag: 'Multi-class' },
  { key: 'titanic', name: 'Titanic Survival', rows: 250, cols: 8, target: 'survived', tag: 'Tabular / Missing' },
  { key: 'customer_churn', name: 'Customer Churn', rows: 300, cols: 7, target: 'churn', tag: 'Binary / Churn' },
  { key: 'credit_default', name: 'Credit Default', rows: 300, cols: 7, target: 'default_payment', tag: 'Imbalanced' },
]

export const DatasetUploader: React.FC = () => {
  const { dataProfile, setDataProfile, setDatasetId, setSuggestions, updateBlockParams, selectedBlockId, blocks } = usePipelineStore()
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingSample, setLoadingSample] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processLoadedDataset = useCallback(async (datasetId: number, filename: string, targetHint?: string) => {
    const profile = await getDatasetProfile(datasetId, filename)
    setDataProfile(profile)
    setDatasetId(datasetId)
    const cards = await getDatasetSuggestions(datasetId)
    const typeMap: Record<string, Suggestion['blockType']> = {
      'Missing Values': 'missing_values', 'Scaling': 'scaling', Encoding: 'encoding',
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

    const finalTarget = targetHint ?? profile.columns[profile.columns.length - 1]?.name ?? 'target'
    const datasetBlockId = blocks.find((block) => block.type === 'dataset')?.id ?? selectedBlockId
    if (datasetBlockId) {
      updateBlockParams(datasetBlockId, { filename, target_column: finalTarget })
    }
  }, [setDataProfile, setDatasetId, setSuggestions, updateBlockParams, selectedBlockId, blocks])

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Only CSV files are supported.'); return }
    setLoading(true); setError(null)
    try {
      const dataset = await uploadDataset(file)
      await processLoadedDataset(dataset.id, dataset.filename)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dataset upload failed.')
    } finally {
      setLoading(false)
    }
  }, [processLoadedDataset])

  const handleSampleClick = async (sample: typeof SAMPLE_DATASETS[0]) => {
    setLoadingSample(sample.key)
    setError(null)
    try {
      const dataset = await loadSampleDataset(sample.key)
      await processLoadedDataset(dataset.id, dataset.filename, sample.target)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load sample dataset.')
    } finally {
      setLoadingSample(null)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  if (dataProfile && dataProfile.columns.length > 0) {
    return (
      <div className="space-y-3">
        {/* Profile header */}
        <div className="flex items-center gap-2 p-2.5 rounded border border-success/30 bg-success/5">
          <CheckCircle className="w-4 h-4 text-success shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-success truncate">{dataProfile.filename}</div>
            <div className="text-[10px] text-text-muted">{dataProfile.rows.toLocaleString()} rows · {dataProfile.cols} columns</div>
          </div>
          <button
            onClick={() => { setDataProfile({ filename: '', rows: 0, cols: 0, columns: [] }); setDatasetId(null); setSuggestions([]) }}
            className="ml-auto text-[10px] text-text-muted hover:text-text border border-border rounded px-1.5 py-0.5 shrink-0 hover:bg-surface-active transition-colors"
          >
            Replace
          </button>
        </div>

        {/* Column table */}
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-surface-hover border-b border-border text-text-muted">
                <th className="text-left px-2 py-1.5 font-semibold">Column</th>
                <th className="text-left px-2 py-1.5 font-semibold">Type</th>
                <th className="text-right px-2 py-1.5 font-semibold">Missing</th>
                <th className="text-right px-2 py-1.5 font-semibold">Skew</th>
              </tr>
            </thead>
            <tbody>
              {dataProfile.columns.map((col, i) => (
                <tr key={col.name} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-surface-hover/30'}`}>
                  <td className="px-2 py-1 font-mono text-text truncate max-w-[80px]">{col.name}</td>
                  <td className="px-2 py-1"><TypeBadge type={col.type} /></td>
                  <td className={`px-2 py-1 text-right font-mono ${col.missing_pct > 10 ? 'text-red-400' : col.missing_pct > 0 ? 'text-yellow-400' : 'text-text-dark'}`}>
                    {col.missing_pct}%
                  </td>
                  <td className={`px-2 py-1 text-right font-mono ${col.skew !== undefined && Math.abs(col.skew) > 1.5 ? 'text-yellow-400' : 'text-text-dark'}`}>
                    {col.skew !== undefined ? col.skew : col.unique !== undefined ? `${col.unique}u` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { icon: Hash, label: 'Numeric', val: dataProfile.columns.filter(c => c.type === 'numeric').length, color: 'text-blue-400' },
            { icon: FileText, label: 'Categorical', val: dataProfile.columns.filter(c => c.type === 'categorical').length, color: 'text-purple-400' },
            { icon: TrendingUp, label: 'Missing', val: dataProfile.columns.filter(c => c.missing_pct > 0).length, color: 'text-yellow-400' },
          ].map(({ icon: Icon, label, val, color }) => (
            <div key={label} className="p-2 rounded border border-border bg-surface-hover/50 text-center">
              <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color}`} />
              <div className={`text-sm font-mono font-bold ${color}`}>{val}</div>
              <div className="text-[9px] text-text-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-default ${
          dragging ? 'border-accent bg-accent/10' : 'border-border hover:border-border bg-surface-hover/30'
        }`}
      >
        <Upload className={`w-7 h-7 mx-auto mb-2 ${dragging ? 'text-accent' : 'text-text-dark'}`} />
        <p className="text-xs font-medium text-text mb-1">Drag & drop CSV here</p>
        <p className="text-[10px] text-text-muted mb-3">or browse from your computer</p>
        <label className="text-[11px] px-3 py-1.5 rounded bg-surface border border-border text-text hover:bg-surface-active cursor-pointer transition-colors">
          Browse Files
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </label>
      </div>

      {(loading || loadingSample) && (
        <div className="flex items-center gap-2 text-xs text-accent p-2 rounded bg-accent/10 border border-accent/20">
          <span className="animate-spin">⟳</span> Profiling dataset & computing suggestions…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 p-2 rounded bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {/* Sample datasets */}
      <div>
        <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5 font-semibold flex items-center justify-between">
          <span>Or load built-in sample</span>
          <span className="text-[9px] text-accent flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> 1-Click</span>
        </div>
        <div className="space-y-1.5">
          {SAMPLE_DATASETS.map((ds) => (
            <button
              key={ds.key}
              onClick={() => handleSampleClick(ds)}
              disabled={loading || loadingSample !== null}
              className="w-full text-left p-2 rounded border border-border bg-surface-hover/50 hover:border-accent/40 hover:bg-surface-active text-xs transition-all disabled:opacity-50 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-text group-hover:text-white">{ds.name}</span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-surface text-text-muted border border-border">
                  {ds.tag}
                </span>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {ds.rows} rows · {ds.cols} cols · target: <span className="font-mono text-accent">{ds.target}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
