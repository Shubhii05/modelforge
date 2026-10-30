import React from 'react'
import { Play, Code2, Eye, EyeOff, LayoutTemplate, Layers, Sparkles, Bot } from 'lucide-react'

interface TopBarProps {
  projectName?: string
  isRunning?: boolean
  showCode?: boolean
  transparencyMode?: boolean
  activeTab?: string
  onToggleCode?: () => void
  onToggleTransparency?: () => void
  onRunPipeline?: () => void
  onOpenTemplates?: () => void
  onOpenUseCase?: () => void
  onToggleAssistant?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName = 'Credit Default Prediction',
  isRunning = false,
  showCode = true,
  transparencyMode = true,
  activeTab,
  onToggleCode,
  onToggleTransparency,
  onRunPipeline,
  onOpenTemplates,
  onOpenUseCase,
  onToggleAssistant,
}) => {
  return (
    <header className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
            <Layers className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
            ModelForge
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-active border border-border text-text-muted">
              v0.1
            </span>
          </span>
        </div>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">Pipeline:</span>
          <span className="font-medium text-text bg-surface-hover px-2 py-0.5 rounded border border-border">
            {projectName}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Describe Use Case CTA */}
        <button
          onClick={onOpenUseCase}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 transition-all shadow-sm"
          title="Describe use case in plain text to generate pipeline"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Use Case Setup</span>
        </button>

        {/* AI Assistant toggle */}
        <button
          onClick={onToggleAssistant}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${
            activeTab === 'assistant'
              ? 'border-accent/40 bg-accent/20 text-accent font-semibold'
              : 'border-border bg-surface-hover hover:bg-surface-active text-text'
          }`}
          title="Toggle AI Co-Pilot Assistant"
        >
          <Bot className="w-3.5 h-3.5 text-accent" />
          <span>AI Assistant</span>
        </button>

        <div className="h-4 w-[1px] bg-border mx-0.5" />

        {/* Transparency study toggle */}
        <button
          onClick={onToggleTransparency}
          title={transparencyMode ? "Transparency Mode: ON (Code & explanations visible)" : "Transparency Mode: OFF (Black-box study condition)"}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${
            transparencyMode
              ? "bg-surface-active border-border text-text hover:border-text-muted"
              : "bg-surface-hover border-border text-text-muted opacity-60"
          }`}
        >
          {transparencyMode ? <Eye className="w-3.5 h-3.5 text-accent" /> : <EyeOff className="w-3.5 h-3.5 text-text-dark" />}
          <span>Transparency</span>
          <span className={`text-[10px] px-1 rounded font-mono ${transparencyMode ? 'bg-accent/20 text-accent' : 'bg-surface text-text-dark'}`}>
            {transparencyMode ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Templates button */}
        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-border bg-surface-hover hover:bg-surface-active text-text transition-colors"
        >
          <LayoutTemplate className="w-3.5 h-3.5 text-text-muted" />
          <span>Templates</span>
        </button>

        {/* Code view toggle */}
        {transparencyMode && (
          <button
            onClick={onToggleCode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${
              showCode
                ? "border-accent/40 bg-accent/10 text-accent font-medium"
                : "border-border bg-surface-hover hover:bg-surface-active text-text"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>
        )}

        {/* Run Pipeline CTA */}
        <button
          onClick={onRunPipeline}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3.5 py-1 rounded text-xs font-semibold bg-accent hover:bg-accent-hover active:scale-[0.98] text-white shadow-sm transition-all disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-pulse' : ''}`} />
          <span>{isRunning ? 'Training…' : 'Run Pipeline'}</span>
        </button>
      </div>
    </header>
  )
}
