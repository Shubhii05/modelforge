import React, { useState, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { TopBar } from './components/TopBar'
import { PipelineCanvas } from './features/canvas/PipelineCanvas'
import { ConfigPanel } from './features/config/ConfigPanel'
import { DatasetUploader } from './features/dataset/DatasetUploader'
import { SuggestionCards } from './features/suggestions/SuggestionCards'
import { ResultsPanel } from './features/results/ResultsPanel'
import { PlaygroundPanel } from './features/playground/PlaygroundPanel'
import { TemplatesModal } from './features/templates/TemplatesModal'
import { usePipelineStore } from './store'
import { BLOCK_CATALOG } from './types/catalog'
import type { BlockCategory } from './types/pipeline'
import { Sliders, Database } from 'lucide-react'
import { CodePanel } from './features/code/CodePanel'
import { runPipeline } from './lib/pipelineRunner'

const CATEGORY_LABELS: Record<BlockCategory, string> = {
  data: 'Data Source',
  preprocessing: 'Preprocessing',
  model: 'Model Training',
  output: 'Evaluation & Output',
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'playground'>('config')
  const [showTemplates, setShowTemplates] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const cancelRunRef = useRef<(() => void) | null>(null)

  const {
    transparencyMode, showCode, setTransparencyMode, setShowCode,
    projectName, isRunning, blocks, datasetId,
    setIsRunning, setRunResults, setCurrentEpoch, addEpochMetric, clearResults,
  } = usePipelineStore()

  const grouped = BLOCK_CATALOG.reduce<Record<BlockCategory, typeof BLOCK_CATALOG>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = []
    acc[entry.category].push(entry)
    return acc
  }, {} as Record<BlockCategory, typeof BLOCK_CATALOG>)

  const handleRunPipeline = () => {
    if (isRunning) {
      // Cancel in-progress run
      cancelRunRef.current?.()
      cancelRunRef.current = null
      setIsRunning(false)
      return
    }

    clearResults()
    setRunError(null)
    setIsRunning(true)
    setActiveTab('results')

    cancelRunRef.current = runPipeline(blocks, {
      onEpoch: (epoch, metric) => {
        setCurrentEpoch(epoch)
        addEpochMetric(metric)
      },
      onDone: (results) => {
        setRunResults(results)
        setIsRunning(false)
        cancelRunRef.current = null
      },
      onError: (message) => {
        setRunError(message)
        setIsRunning(false)
        cancelRunRef.current = null
      },
    }, datasetId, projectName)
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-text select-none">
      <TopBar
        projectName={projectName}
        isRunning={isRunning}
        showCode={showCode}
        transparencyMode={transparencyMode}
        onToggleCode={() => setShowCode(!showCode)}
        onToggleTransparency={() => setTransparencyMode(!transparencyMode)}
        onRunPipeline={handleRunPipeline}
        onOpenTemplates={() => setShowTemplates(true)}
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
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {runError && <div role="alert" className="mx-3 mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{runError}</div>}
            {activeTab === 'config' && (
              <div className="space-y-0">
                <ConfigPanel />
                <div className="px-4 pb-4 space-y-4">
                  <DatasetUploader />
                  <SuggestionCards />
                </div>
              </div>
            )}

            {activeTab === 'results' && <ResultsPanel />}

            {activeTab === 'playground' && <PlaygroundPanel />}
          </div>
        </aside>
      </div>

      {/* Templates Modal */}
      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} />}
    </div>
  )
}

export default App
