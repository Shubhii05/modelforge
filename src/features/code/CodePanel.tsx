import React, { useEffect, useRef } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Terminal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { usePipelineStore } from '../../store'
import { fetchGeneratedCode, savePipelineSpec, toApiPipelineBlocks } from '../../api/client'

export const CodePanel: React.FC = () => {
  const { blocks, showCode, setShowCode, transparencyMode, datasetId, projectName } = usePipelineStore()
  const [copied, setCopied] = React.useState(false)
  const [code, setCode] = React.useState('# Upload a CSV dataset to generate pipeline code.')
  const pipelineId = useRef<number | null>(null)
  const pipelineDatasetId = useRef<number | null>(null)
  const codeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (datasetId === null) {
      pipelineId.current = null
      pipelineDatasetId.current = null
      setCode('# Upload a CSV dataset to generate pipeline code.')
      return
    }
    if (pipelineDatasetId.current !== datasetId) {
      pipelineDatasetId.current = datasetId
      pipelineId.current = null
    }
    let current = true
    const targetColumn = String(blocks.find((block) => block.type === 'dataset')?.params.target_column ?? '')
    setCode('# Updating generated code from the current pipeline spec...')
    void (async () => {
      try {
        const id = await savePipelineSpec({ name: projectName, dataset_id: datasetId, blocks: toApiPipelineBlocks(blocks) }, pipelineId.current)
        pipelineId.current = id
        const nextCode = await fetchGeneratedCode(id, targetColumn)
        if (current) setCode(nextCode)
      } catch (error) {
        if (current) setCode(`# Code generation unavailable: ${error instanceof Error ? error.message : 'request failed'}`)
      }
    })()
    return () => { current = false }
  }, [blocks, datasetId, projectName])

  // Auto-scroll to bottom when code changes
  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight
    }
  }, [code])

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (!transparencyMode) return null

  if (!showCode) {
    return (
      <div className="h-7 border-t border-border bg-surface flex items-center justify-between px-3 shrink-0">
        <span className="text-[11px] font-mono text-text-muted flex items-center gap-1.5">
          <Terminal className="w-3 h-3 text-accent" />
          pipeline.py
          <span className="text-[10px] px-1 rounded bg-surface-active border border-border text-text-dark">
            {blocks.length} blocks · collapsed
          </span>
        </span>
        <button
          onClick={() => setShowCode(true)}
          className="text-text-muted hover:text-text flex items-center gap-1 text-[11px]"
        >
          Expand <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="h-52 border-t border-border bg-surface flex flex-col shrink-0">
      {/* Header */}
      <div className="h-8 border-b border-border px-3 flex items-center justify-between bg-surface-hover shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold font-mono text-white">pipeline.py</span>
          <span className="text-[10px] font-mono px-1.5 py-px rounded bg-surface border border-border text-text-muted">
            Derived · Read-only · {blocks.length} blocks
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-surface-active"
          >
            {copied ? (
              <><Check className="w-3 h-3 text-success" /><span className="text-success">Copied</span></>
            ) : (
              <><Copy className="w-3 h-3" /><span>Copy</span></>
            )}
          </button>
          <button onClick={() => setShowCode(false)} className="text-text-muted hover:text-text p-1">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Code */}
      <div ref={codeRef} className="flex-1 overflow-auto text-xs">
        <SyntaxHighlighter
          language="python"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '10px 12px',
            background: '#080A0E',
            fontSize: '11px',
            lineHeight: '1.6',
            minHeight: '100%',
            fontFamily: '"JetBrains Mono", monospace',
          }}
          showLineNumbers
          lineNumberStyle={{ color: '#3E485E', minWidth: '2.5em', paddingRight: '1em' }}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
