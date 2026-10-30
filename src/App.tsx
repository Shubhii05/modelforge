import React, { useState } from 'react'
import { TopBar } from './components/TopBar'
import { usePipelineStore } from './store'
import { Sliders, Activity, Terminal, ChevronDown, ChevronUp, Sparkles, Database } from 'lucide-react'
import { BLOCK_CATALOG } from './types/catalog'
import type { BlockCategory } from './types/pipeline'

const CATEGORY_LABELS: Record<BlockCategory, string> = {
  data: 'Data Source',
  preprocessing: 'Preprocessing',
  model: 'Model Training',
  output: 'Evaluation & Output',
}

export const App: React.FC = () => {
  const {
    transparencyMode, showCode, setTransparencyMode, setShowCode,
    projectName, isRunning, runResults, blocks, selectedBlockId,
    selectBlock,
  } = usePipelineStore()

  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'playground'>('config')

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)

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
        {/* Left: Block Palette */}
        <aside className="w-60 border-r border-border bg-surface flex flex-col shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase text-text-muted">Palette</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-active text-text-muted border border-border">Drag</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {(Object.keys(CATEGORY_LABELS) as BlockCategory[]).map((cat) => (
              <div key={cat}>
                <div className="text-[11px] font-semibold text-text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  {cat === 'data' && <Database className="w-3 h-3 text-accent" />}
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="space-y-1.5">
                  {(grouped[cat] ?? []).map((entry) => (
                    <div
                      key={entry.type}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('blockType', entry.type)}
                      className="p-2 rounded border border-border bg-surface-hover/60 hover:border-accent/30 hover:bg-surface-active text-xs cursor-grab transition-colors"
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
        </aside>

        {/* Center: Canvas + Code Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Canvas placeholder (wired up in P3) */}
          <div
            className="flex-1 relative overflow-hidden bg-[#08090D] flex items-center justify-center"
            onClick={() => selectBlock(null)}
          >
            <div className="text-center p-6 rounded-lg border border-border bg-surface/50 max-w-sm">
              <Sparkles className="w-8 h-8 text-accent mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-semibold text-white mb-1">
                {blocks.length} block{blocks.length !== 1 ? 's' : ''} in pipeline
              </h3>
              <p className="text-xs text-text-muted">
                React Flow canvas wires up in P3. Store has {blocks.length} blocks ready.
              </p>
            </div>
          </div>

          {/* Code panel */}
          {transparencyMode && showCode && (
            <div className="h-44 border-t border-border bg-surface flex flex-col shrink-0">
              <div className="h-8 border-b border-border px-3 flex items-center justify-between bg-surface-hover">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-semibold font-mono text-white">pipeline.py</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-surface border border-border text-text-muted">
                    Derived from spec · Read-only
                  </span>
                </div>
                <button onClick={() => setShowCode(false)} className="text-text-muted hover:text-text p-1">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 p-3 font-mono text-xs overflow-auto text-text-muted bg-[#080A0E]">
                <pre className="text-text">{`# ${blocks.length} block(s) in spec — code generator wires in P4\n` +
                  blocks.map((b) => `# [${b.type}] ${b.label}`).join('\n')}</pre>
              </div>
            </div>
          )}
          {transparencyMode && !showCode && (
            <div className="h-7 border-t border-border bg-surface flex items-center justify-between px-3">
              <span className="text-[11px] font-mono text-text-muted flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-accent" />pipeline.py (collapsed)
              </span>
              <button onClick={() => setShowCode(true)} className="text-text-muted hover:text-text flex items-center gap-1 text-[11px]">
                <span>Expand</span><ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Config | Results | Playground */}
        <aside className="w-80 border-l border-border bg-surface flex flex-col shrink-0">
          <div className="h-10 border-b border-border flex items-center px-2 gap-1">
            {(['config', 'results', 'playground'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-medium rounded capitalize transition-colors flex items-center justify-center gap-1.5 ${
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

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'config' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-white uppercase tracking-wider">
                  {selectedBlock ? selectedBlock.label : 'Select a block'}
                </div>
                {selectedBlock ? (
                  <div className="p-3 rounded border border-border bg-surface-hover/50 space-y-2">
                    {transparencyMode && (
                      <div className="p-2 rounded bg-surface border border-border text-[11px] text-accent/80 italic">
                        Select a block on the canvas to configure its parameters.
                      </div>
                    )}
                    <pre className="text-[10px] font-mono text-text-muted bg-background p-2 rounded border border-border overflow-auto">
                      {JSON.stringify(selectedBlock.params, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Click a block on the canvas to configure it here.</p>
                )}
              </div>
            )}

            {activeTab === 'results' && (
              <div className="space-y-4">
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
              <div className="space-y-3">
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
