import React, { useState, useEffect, useRef } from 'react'
import {
  Bot, Sparkles, Send, CheckCircle2, Circle, ArrowRight,
  Database, Activity, Play, Sliders, AlertTriangle, Lightbulb,
  HelpCircle, RefreshCw, Layers
} from 'lucide-react'
import { usePipelineStore } from '../../store'
import { askAIAssistant, loadSampleDataset, getDatasetProfile, getDatasetSuggestions } from '../../api/client'
import type { Suggestion, BlockType } from '../../types/pipeline'

interface ChatMessage {
  id: string
  sender: 'assistant' | 'user'
  text: string
  actions?: Array<{ label: string; action_type: string; payload?: Record<string, unknown> }>
  timestamp: string
}

interface AIAssistantProps {
  onOpenUseCaseModal?: () => void
  onRunPipeline?: () => void
  onSwitchTab?: (tab: 'config' | 'results' | 'playground') => void
}

const STEPS = [
  { id: 1, name: 'Use Case', desc: 'Define ML objective' },
  { id: 2, name: 'Dataset', desc: 'Upload & profile CSV' },
  { id: 3, name: 'Pipeline', desc: 'Preprocessing & model' },
  { id: 4, name: 'Train', desc: 'Fit scikit-learn model' },
  { id: 5, name: 'Inference', desc: 'Playground & metrics' },
]

export const AIAssistant: React.FC<AIAssistantProps> = ({
  onOpenUseCaseModal,
  onRunPipeline,
  onSwitchTab,
}) => {
  const {
    projectName, blocks, dataProfile, datasetId, suggestions,
    runResults, isRunning, answerSuggestion, addBlock, updateBlockParams,
    setDataProfile, setDatasetId, setSuggestions
  } = usePipelineStore()

  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Determine current active step (1 to 5)
  const currentStep = React.useMemo(() => {
    if (runResults?.runId) return 5
    if (isRunning) return 4
    if (dataProfile && dataProfile.columns.length > 0) return 3
    if (datasetId) return 2
    return 1
  }, [runResults, isRunning, dataProfile, datasetId])

  // Initial welcome greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `👋 **Hello! I'm your ModelForge AI Co-Pilot.**\n\nI'm here to guide you step-by-step from problem definition to real model inference.\n\n` +
            (dataProfile
              ? `Currently loaded: **${dataProfile.filename}** (${dataProfile.rows} rows). Ready to refine blocks or train!`
              : `To start, click **Describe Use Case** above or pick a sample dataset below to generate your initial pipeline.`),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }
  }, [messages.length, dataProfile])

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSendMessage = async (msgText?: string) => {
    const textToSend = (msgText ?? inputMessage).trim()
    if (!textToSend || loading) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputMessage('')
    setLoading(true)

    try {
      const context = {
        projectName,
        datasetId,
        dataProfile,
        blocks: blocks.map((b) => ({ id: b.id, type: b.type, params: b.params })),
        suggestionsCount: suggestions.length,
        runResults: runResults ? {
          runId: runResults.runId,
          accuracy: runResults.accuracy,
          precision: runResults.precision,
          f1: runResults.f1,
          loss: runResults.loss,
        } : null,
        isRunning,
      }

      const res = await askAIAssistant(textToSend, context)

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        actions: res.actions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      // Local fallback assistant response
      let fallbackText = "I'm analyzing your current pipeline. "
      if (!dataProfile) {
        fallbackText += "First, upload a dataset or click **Describe Use Case** to generate an initial pipeline."
      } else if (!runResults) {
        fallbackText += `Dataset '${dataProfile.filename}' has ${dataProfile.rows} rows. Review suggestions and click **Run Pipeline** in the top bar to train real model weights.`
      } else {
        fallbackText += `Your model achieved ${(runResults.accuracy * 100).toFixed(1)}% accuracy. Switch to the **Playground** tab to test live predictions!`
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-fallback-${Date.now()}`,
          sender: 'assistant',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleActionClick = async (action: { label: string; action_type: string; payload?: Record<string, unknown> }) => {
    if (action.action_type === 'usecase_modal' || action.action_type === 'usecase_preset') {
      onOpenUseCaseModal?.()
    } else if (action.action_type === 'run_training') {
      onRunPipeline?.()
    } else if (action.action_type === 'open_playground') {
      onSwitchTab?.('playground')
    } else if (action.action_type === 'load_sample' && action.payload?.key) {
      try {
        const dataset = await loadSampleDataset(String(action.payload.key))
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
      } catch (err) {
        // Handled gracefully
      }
    } else if (action.action_type === 'add_block' && action.payload?.type) {
      addBlock(action.payload.type as BlockType)
    }
  }

  const QUICK_PROMPTS = [
    'How do I improve model accuracy?',
    'Explain my dataset profile',
    'Why use Random Forest vs XGBoost?',
    'What does the confusion matrix show?',
  ]

  return (
    <div className="flex flex-col h-full bg-surface select-text">
      {/* ── Stepper Header ── */}
      <div className="p-3 border-b border-border bg-surface-hover/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Bot className="w-3 h-3 text-accent" />
            </div>
            <span className="text-xs font-semibold text-white">AI Co-Pilot</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/25">
            Step {currentStep} of 5
          </span>
        </div>

        {/* Progress track */}
        <div className="flex items-center justify-between gap-1">
          {STEPS.map((s) => {
            const isDone = s.id < currentStep
            const isCurr = s.id === currentStep
            return (
              <div key={s.id} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full h-1 rounded-full mb-1 transition-colors ${
                    isDone ? 'bg-success' : isCurr ? 'bg-accent' : 'bg-surface-active'
                  }`}
                />
                <span className={`text-[9px] font-mono truncate ${
                  isCurr ? 'text-accent font-semibold' : isDone ? 'text-success' : 'text-text-muted'
                }`}>
                  {s.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Contextual Active Stage Banner ── */}
      <div className="p-3 border-b border-border bg-surface-hover/40 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono text-text-muted">Current Focus</div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {currentStep === 1 && '1. Describe Use Case'}
              {currentStep === 2 && '2. Upload & Profile Dataset'}
              {currentStep === 3 && '3. Pipeline Preprocessing & Architecture'}
              {currentStep === 4 && '4. Real Model Training'}
              {currentStep === 5 && '5. Model Diagnostics & Live Testing'}
            </div>
          </div>
          {currentStep === 1 && (
            <button
              onClick={onOpenUseCaseModal}
              className="flex items-center gap-1 text-[10px] font-semibold bg-accent hover:bg-accent-hover text-white px-2 py-1 rounded shadow-sm transition-all"
            >
              <Sparkles className="w-3 h-3" /> Start
            </button>
          )}
          {currentStep === 3 && (
            <button
              onClick={onRunPipeline}
              className="flex items-center gap-1 text-[10px] font-semibold bg-accent hover:bg-accent-hover text-white px-2.5 py-1 rounded shadow-sm transition-all"
            >
              <Play className="w-3 h-3 fill-current" /> Train
            </button>
          )}
          {currentStep === 5 && (
            <button
              onClick={() => onSwitchTab?.('playground')}
              className="flex items-center gap-1 text-[10px] font-semibold bg-accent hover:bg-accent-hover text-white px-2 py-1 rounded shadow-sm transition-all"
            >
              Playground →
            </button>
          )}
        </div>

        <div className="text-[11px] text-text-muted leading-relaxed">
          {currentStep === 1 && 'Define your objective in plain text to let the assistant configure the initial blocks.'}
          {currentStep === 2 && 'Upload your dataset CSV to inspect missing values, column skew, and class balance.'}
          {currentStep === 3 && `${suggestions.filter(s => s.accepted === null).length} dataset suggestion(s) pending. Review to optimize model preprocessing.`}
          {currentStep === 4 && 'Training fitted scikit-learn weights via SSE stream with live epochs.'}
          {currentStep === 5 && `Model trained with ${((runResults?.accuracy ?? 0) * 100).toFixed(1)}% accuracy. Ready for live test queries.`}
        </div>
      </div>

      {/* ── Chat Messages ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed space-y-1.5 ${
                m.sender === 'user'
                  ? 'bg-accent text-white rounded-br-none'
                  : 'bg-surface-hover/80 border border-border text-text rounded-bl-none'
              }`}
            >
              <div className="prose prose-invert prose-xs text-xs whitespace-pre-line">
                {m.text}
              </div>

              {m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/40">
                  {m.actions.map((act) => (
                    <button
                      key={act.label}
                      onClick={() => handleActionClick(act)}
                      className="text-[10px] font-semibold bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 rounded px-2 py-0.5 transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[9px] text-text-muted/60 mt-0.5 px-1 font-mono">
              {m.timestamp}
            </span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-hover/50 border border-border text-xs text-text-muted">
            <Bot className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span>AI assistant is thinking…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Prompts ── */}
      <div className="p-2 border-t border-border/50 bg-surface-hover/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendMessage(prompt)}
            disabled={loading}
            className="text-[10px] text-text-muted hover:text-white bg-surface hover:bg-surface-active border border-border rounded px-2 py-1 whitespace-nowrap transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* ── Chat Input ── */}
      <div className="p-3 border-t border-border bg-surface flex items-center gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSendMessage()
            }
          }}
          placeholder="Ask AI anything about your pipeline..."
          className="flex-1 bg-surface-hover/60 border border-border rounded-lg px-3 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/60"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={loading || !inputMessage.trim()}
          className="w-8 h-8 rounded-lg bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-all disabled:opacity-40 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
