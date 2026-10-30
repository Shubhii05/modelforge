import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Activity, Target, Loader2 } from 'lucide-react'
import { usePipelineStore } from '../../store'

// ── Tiny stat card ──────────────────────────────────────────────────────────
const Stat: React.FC<{ label: string; value: string; color?: string }> = ({
  label, value, color = 'text-text',
}) => (
  <div className="p-2.5 rounded border border-border bg-surface-hover/50">
    <div className="text-[10px] text-text-muted uppercase tracking-wide">{label}</div>
    <div className={`text-lg font-mono font-semibold ${color}`}>{value}</div>
  </div>
)

// ── Custom tooltip for recharts ─────────────────────────────────────────────
const ChartTooltip: React.FC<{ active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string | number }> = ({
  active, payload, label,
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded px-2.5 py-2 text-[11px] shadow-lg">
      <div className="text-text-muted mb-1 font-mono">Epoch {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-muted capitalize">{p.name}:</span>
          <span className="text-white font-mono">{(p.value * (p.name === 'accuracy' ? 100 : 1)).toFixed(p.name === 'accuracy' ? 1 : 3)}{p.name === 'accuracy' ? '%' : ''}</span>
        </div>
      ))}
    </div>
  )
}

// ── Confusion Matrix ─────────────────────────────────────────────────────────
const ConfusionMatrix: React.FC<{ matrix: number[][] }> = ({ matrix }) => {
  const total = matrix.flat().reduce((sum, value) => sum + value, 0)

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-text-muted uppercase tracking-wide font-semibold flex items-center gap-1.5">
        <Target className="w-3 h-3" /> Confusion Matrix
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-[10px] font-mono">
          <thead><tr><th className="p-1 text-text-muted">Actual ↓ / Predicted →</th>{matrix[0]?.map((_, index) => <th key={index} className="p-1 text-text-muted">{index}</th>)}</tr></thead>
          <tbody>{matrix.map((row, rowIndex) => <tr key={rowIndex}><th className="p-1 text-text-muted">{rowIndex}</th>{row.map((value, colIndex) => <td key={colIndex} className={`p-2 border ${rowIndex === colIndex ? 'bg-success/15 text-success border-success/30' : 'bg-red-500/10 text-red-300 border-red-500/20'}`}>{value.toLocaleString()}<div className="text-[9px] opacity-60">{total ? ((value / total) * 100).toFixed(1) : '0.0'}%</div></td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="text-[9px] text-text-muted text-center">
        Predicted → / Actual ↓ &nbsp;·&nbsp; n={total.toLocaleString()}
      </div>
    </div>
  )
}

// ── Main Results Panel ───────────────────────────────────────────────────────
export const ResultsPanel: React.FC = () => {
  const { runResults, isRunning, currentEpoch, totalEpochs, epochMetrics } = usePipelineStore()

  if (isRunning) {
    const pct = totalEpochs > 0 ? Math.round((currentEpoch / totalEpochs) * 100) : 0
    return (
      <div className="p-4 space-y-4">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
          Training…
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>Epoch {currentEpoch} / {totalEpochs}</span>
            <span className="font-mono text-accent">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-active overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Live chart during training */}
        {epochMetrics.length > 1 && (
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={epochMetrics} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2430" />
                <XAxis dataKey="epoch" tick={{ fontSize: 9, fill: '#5A677D' }} />
                <YAxis tick={{ fontSize: 9, fill: '#5A677D' }} domain={[0, 1]} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="accuracy" stroke="#FF6B2C" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="loss" stroke="#3E9EFF" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    )
  }

  if (!runResults) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-text-muted" />
          Pipeline Evaluation
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Press <span className="font-mono text-accent bg-accent/10 px-1 rounded">Run Pipeline</span> to simulate training and see metrics here.
        </p>
      </div>
    )
  }

  const { accuracy, precision, f1, loss, epochMetrics: metrics, confusionMatrix } = runResults

  return (
    <div className="p-4 space-y-5">
      <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-accent" />
        Pipeline Evaluation
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Accuracy"  value={`${(accuracy * 100).toFixed(1)}%`} color="text-success" />
        <Stat label="Precision" value={`${(precision * 100).toFixed(1)}%`} />
        <Stat label="F1 Score"  value={f1.toFixed(3)} />
        <Stat label="Log Loss"  value={loss.toFixed(3)} color="text-text-muted" />
      </div>

      {/* Learning curve */}
      {metrics.length > 1 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">Learning Curve</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2430" />
                <XAxis dataKey="epoch" tick={{ fontSize: 9, fill: '#5A677D' }} label={{ value: 'epoch', position: 'insideBottom', offset: -2, fontSize: 9, fill: '#5A677D' }} />
                <YAxis tick={{ fontSize: 9, fill: '#5A677D' }} domain={[0, 1]} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Line type="monotone" dataKey="accuracy" stroke="#FF6B2C" dot={false} strokeWidth={2} name="accuracy" />
                <Line type="monotone" dataKey="loss"     stroke="#3E9EFF" dot={false} strokeWidth={2} name="loss" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Confusion matrix */}
      <ConfusionMatrix matrix={confusionMatrix} />
    </div>
  )
}
