import React, { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { TopBar } from './components/TopBar'
import { PipelineCanvas } from './features/canvas/PipelineCanvas'
import { ConfigPanel } from './features/config/ConfigPanel'
import { usePipelineStore } from './store'
import { BLOCK_CATALOG } from './types/catalog'
import type { BlockCategory } from './types/pipeline'
import { Sliders, Activity, Database } from 'lucide-react'
import { CodePanel } from './features/code/CodePanel'

const CATEGORY_LABELS: Record<BlockCategory, string> = {
  data: 'Data Source',
  preprocessing: 'Preprocessing',
  model: 'Model Training',
  output: 'Evaluation & Output',
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'playground'>('config')

  const {
    transparencyMode, showCode, setTransparencyMode, setShowCode,
    projectName, isRunning, runResults, blocks,
  } = usePipelineStore()

  const grouped = BLOCK_CATALOG.reduce<Record<BlockCategory, typeof BLOCK_CATALOG>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push(entry)
    return acc
  }, {} as Record<BlockCategory, typeof BLOCK_CATALOG>)

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-text select-none">
      <TopBar
        projectName={projectName}
        isRunning={isRunning}
        showCode={showCode}
        transparencyMode={transparencyMode}
        onToggleCode={() => setShowCode(!showCode)}
        onToggleTransparency={() => setTransparencyMode(!transparencyMode)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Block Palette ── */}
        <aside className="w-56 border-r border-border bg-surface flex flex-col shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase text-text-muted">Palette</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-active text-text-muted border border-border">
              Drag →
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {(Object.keys(CATEGORY_LABELS) as BlockCategory[]).map((cat) => (
              <div key={cat}>
                <div className="text-[11px] font-semibold text-text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  {cat === 'data' && <Database className="w-3 h-3 text-blue-400" />}
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="space-y-1.5">
                  {(grouped[cat] ?? []).map((entry) => (
                    <div
                      key={entry.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('blockType', entry.type)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      className="p-2 rounded border border-border bg-surface-hover/60 hover:border-accent/30 hover:bg-surface-active text-xs cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <div className="font-medium text-text flex items-center justify-between">
                        <span>{entry.label}</span>
                        {entry.isAI && (
                          <span className="text-[9px] px-1 py-px rounded bg-accent/20 text-accent font-mono">AI</span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted leading-tight mt-0.5">{entry.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline summary */}
          <div className="p-3 border-t border-border bg-surface-hover/30 text-[10px] text-text-muted">
            <span className="font-mono text-accent">{blocks.length}</span> blocks · <span className="font-mono text-accent">1</span> pipeline
          </div>
        </aside>

        {/* ── Center: Canvas + Code Panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden">
            <ReactFlowProvider>
              <PipelineCanvas />
            </ReactFlowProvider>
          </div>

          <CodePanel />
        </div>

        {/* ── Right: Config | Results | Playground ── */}
        <aside className="w-80 border-l border-border bg-surface flex flex-col shrink-0">
          <div className="h-10 border-b border-border flex items-center px-2 gap-1">
            {(['config', 'results', 'playground'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-medium rounded capitalize transition-colors flex items-center justify-center gap-1 ${
                  activeTab === tab
                    ? 'bg-surface-active text-white border border-border'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab === 'config' && <Sliders className="w-3 h-3" />}
                {tab === 'results' && <Activity className="w-3 h-3" />}
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'config' && <ConfigPanel />}

            {activeTab === 'results' && (
              <div className="p-4 space-y-4">
                <div className="text-xs font-semibold text-white uppercase tracking-wider">Pipeline Evaluation</div>
                {runResults ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded border border-border bg-surface-hover/50">
                      <div className="text-[10px] text-text-muted uppercase">Accuracy</div>
                      <div className="text-lg font-mono font-semibold text-success">{(runResults.accuracy * 100).toFixed(1)}%</div>
                    </div>
                    <div className="p-2.5 rounded border border-border bg-surface-hover/50">
                      <div className="text-[10px] text-text-muted uppercase">Precision</div>
                      <div className="text-lg font-mono font-semibold text-text">{(runResults.precision * 100).toFixed(1)}%</div>
                    </div>
                    <div className="p-2.5 rounded border border-border bg-surface-hover/50">
                      <div className="text-[10px] text-text-muted uppercase">F1 Score</div>
                      <div className="text-lg font-mono font-semibold text-text">{runResults.f1.toFixed(3)}</div>
                    </div>
                    <div className="p-2.5 rounded border border-border bg-surface-hover/50">
                      <div className="text-[10px] text-text-muted uppercase">Loss</div>
                      <div className="text-lg font-mono font-semibold text-text-muted">{runResults.loss.toFixed(3)}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Run the pipeline to see results here.</p>
                )}
              </div>
            )}

            {activeTab === 'playground' && (
              <div className="p-4 space-y-3">
                <div className="text-xs font-semibold text-white uppercase tracking-wider">Live Predictions</div>
                <p className="text-xs text-text-muted leading-relaxed">Inference playground wires up in P6.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
