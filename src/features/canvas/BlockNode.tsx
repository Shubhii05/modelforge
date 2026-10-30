import React, { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Trash2, CheckCircle, AlertCircle, Loader2, Check, X, Pencil } from 'lucide-react'
import { usePipelineStore } from '../../store'
import { CATALOG_BY_TYPE } from '../../types/catalog'
import type { BlockType, CustomCodeStatus } from '../../types/pipeline'

// ── Custom code status badge ─────────────────────────────────────────────────
const STATUS_CONFIG: Record<CustomCodeStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  pending:  { label: 'Pending review', cls: 'bg-accent/15 text-accent border-accent/30',         Icon: Loader2 },
  accepted: { label: 'Accepted',       cls: 'bg-success/15 text-success border-success/30',       Icon: Check },
  rejected: { label: 'Rejected',       cls: 'bg-red-500/10 text-red-400 border-red-500/20',       Icon: X },
  editing:  { label: 'Editing',        cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', Icon: Pencil },
}

const CustomCodeBadge: React.FC<{ status: CustomCodeStatus }> = ({ status }) => {
  const { label, cls, Icon } = STATUS_CONFIG[status]
  return (
    <div className={`mt-2 flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border w-fit ${cls}`}>
      <Icon className={`w-2.5 h-2.5 ${status === 'pending' ? 'animate-spin' : ''}`} />
      {label}
    </div>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  data: 'border-blue-500/50 bg-blue-500/5',
  preprocessing: 'border-purple-500/50 bg-purple-500/5',
  model: 'border-accent/50 bg-accent/5',
  output: 'border-success/50 bg-success/5',
}

const CATEGORY_DOT: Record<string, string> = {
  data: 'bg-blue-400',
  preprocessing: 'bg-purple-400',
  model: 'bg-accent',
  output: 'bg-success',
}

export interface BlockNodeData {
  blockId: string
}

export const BlockNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as BlockNodeData
  const { blocks, selectedBlockId, selectBlock, removeBlock } = usePipelineStore()
  const block = blocks.find((b) => b.id === nodeData.blockId)

  if (!block) return null

  const catalog = CATALOG_BY_TYPE[block.type as BlockType]
  const isSelected = selected || selectedBlockId === block.id
  const colorClass = CATEGORY_COLORS[catalog.category] ?? 'border-border'
  const dotClass = CATEGORY_DOT[catalog.category] ?? 'bg-text-muted'

  return (
    <div
      onClick={(e) => { e.stopPropagation(); selectBlock(block.id) }}
      className={`
        relative w-44 rounded-lg border transition-all cursor-pointer select-none
        ${colorClass}
        ${isSelected ? 'ring-1 ring-accent shadow-lg shadow-accent/20 border-accent/70' : 'hover:border-border'}
        bg-surface
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-background"
      />

      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
            <span className="text-xs font-semibold text-white leading-tight truncate">
              {block.label}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}
            className="shrink-0 text-text-dark hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-400/10"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <p className="text-[10px] text-text-muted leading-tight">
          {catalog.description}
        </p>

        {catalog.isAI && (
          <CustomCodeBadge
            status={(block.params.custom_code_status ?? 'pending') as CustomCodeStatus}
          />
        )}

        <div className="mt-2 flex items-center gap-1 text-[10px]">
          {catalog.category === 'output' ? (
            <><CheckCircle className="w-3 h-3 text-success" /><span className="text-success">Output node</span></>
          ) : catalog.category === 'data' ? (
            <><AlertCircle className="w-3 h-3 text-blue-400" /><span className="text-blue-400">Input node</span></>
          ) : (
            <><CheckCircle className="w-3 h-3 text-text-dark" /><span className="text-text-dark capitalize">{catalog.category}</span></>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-background"
      />
    </div>
  )
})

BlockNode.displayName = 'BlockNode'
