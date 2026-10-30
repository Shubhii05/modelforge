import React, { useState } from 'react'
import { Lightbulb, CheckCircle, XCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { usePipelineStore } from '../../store'
import { CATALOG_BY_TYPE } from '../../types/catalog'
import type { Suggestion } from '../../types/pipeline'

const SuggestionCard: React.FC<{ suggestion: Suggestion }> = ({ suggestion }) => {
  const { answerSuggestion, addBlock, updateBlockParams, blocks, transparencyMode } = usePipelineStore()
  const [showExplain, setShowExplain] = useState(false)
  const catalog = CATALOG_BY_TYPE[suggestion.blockType]

  const handleAccept = () => {
    answerSuggestion(suggestion.id, true)

    if (suggestion.blockType === 'dataset') {
      const datasetBlock = blocks.find((b) => b.type === 'dataset')
      if (datasetBlock && suggestion.fixParams) {
        updateBlockParams(datasetBlock.id, suggestion.fixParams)
        return
      }
    }

    const existingBlock = blocks.find((b) => b.type === suggestion.blockType)
    if (existingBlock && suggestion.fixParams) {
      updateBlockParams(existingBlock.id, suggestion.fixParams)
      return
    }

    const newId = addBlock(suggestion.blockType)
    if (newId && suggestion.fixParams) {
      updateBlockParams(newId, suggestion.fixParams)
    }
  }

  if (suggestion.accepted !== null) {
    return (
      <div className={`p-2.5 rounded border text-xs flex items-center gap-2 ${
        suggestion.accepted
          ? 'border-success/30 bg-success/5 text-success'
          : 'border-border bg-surface-hover/30 text-text-dark line-through'
      }`}>
        {suggestion.accepted
          ? <><CheckCircle className="w-3.5 h-3.5 shrink-0" /><span>{suggestion.title} — applied to pipeline</span></>
          : <><XCircle className="w-3.5 h-3.5 shrink-0" /><span>{suggestion.title} — skipped</span></>
        }
      </div>
    )
  }

  return (
    <div className="p-3 rounded border border-border bg-surface-hover/50 space-y-2.5">
      <div className="flex items-start gap-2">
        <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white leading-tight">{suggestion.title}</div>
          <div className="text-[11px] text-text-muted leading-relaxed mt-1">{suggestion.description}</div>
          <div className="text-[10px] font-mono px-1.5 py-px rounded bg-surface border border-border text-text-muted w-fit mt-1.5">
            → {catalog?.label ?? suggestion.blockType}
          </div>
        </div>
      </div>

      {showExplain && transparencyMode && (
        <div className="p-2 rounded bg-surface border border-accent/20 text-[11px] text-accent/80 italic leading-relaxed">
          {suggestion.explanation}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          onClick={handleAccept}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-colors"
        >
          <CheckCircle className="w-3 h-3" /> Accept
        </button>
        <button
          onClick={() => answerSuggestion(suggestion.id, false)}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border border-border text-text-muted hover:text-text hover:bg-surface-active transition-colors"
        >
          <XCircle className="w-3 h-3" /> Skip
        </button>
        {transparencyMode && (
          <button
            onClick={() => setShowExplain((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border border-border text-text-muted hover:text-text hover:bg-surface-active transition-colors ml-auto"
          >
            <HelpCircle className="w-3 h-3" />
            <span>Why?</span>
            {showExplain ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  )
}

export const SuggestionCards: React.FC = () => {
  const { suggestions } = usePipelineStore()
  if (suggestions.length === 0) return null

  const pending = suggestions.filter((s) => s.accepted === null).length

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-accent" />
          Dataset Suggestions
        </div>
        {pending > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-mono border border-accent/30">
            {pending} pending
          </span>
        )}
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} />
        ))}
      </div>
    </div>
  )
}
