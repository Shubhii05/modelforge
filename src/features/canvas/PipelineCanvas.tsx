import React, { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react'
import { usePipelineStore } from '../../store'
import { BlockNode } from './BlockNode'
import type { BlockType } from '../../types/pipeline'

const NODE_TYPES = { block: BlockNode }

export const PipelineCanvas: React.FC = () => {
  const {
    blocks, canvasNodes, canvasEdges,
    addBlock, addEdge: storeAddEdge, removeEdge,
    updateNodePosition, selectBlock,
  } = usePipelineStore()

  // Build React Flow nodes from store
  const rfNodes: Node[] = canvasNodes
    .filter((n) => blocks.find((b) => b.id === n.id))
    .map((n) => ({
      id: n.id,
      type: 'block',
      position: n.position,
      data: { blockId: n.id },
      draggable: true,
    }))

  // Build React Flow edges from store
  const rfEdges: Edge[] = canvasEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    style: { stroke: '#3E485E', strokeWidth: 2 },
    animated: false,
  }))

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    // Sync position changes back to store
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        updateNodePosition(change.id, change.position)
      }
    }
    // We don't need to mirror full RF state; store is source of truth
  }, [updateNodePosition])

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    for (const change of changes) {
      if (change.type === 'remove') {
        removeEdge(change.id)
      }
    }
  }, [removeEdge])

  const onConnect: OnConnect = useCallback(({ source, target }) => {
    if (source && target) storeAddEdge(source, target)
  }, [storeAddEdge])

  const canvasRef = useRef<HTMLDivElement>(null)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('blockType') as BlockType
    if (!type) return

    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return

    // Approximate canvas offset to RF coordinates
    const position = {
      x: e.clientX - bounds.left - 88,
      y: e.clientY - bounds.top - 50,
    }
    addBlock(type, position)
  }, [addBlock])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return (
    <div ref={canvasRef} className="w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => selectBlock(null)}
        deleteKeyCode="Delete"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#08090D' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1F2430"
        />
        <Controls
          className="!bg-surface !border-border !rounded-lg"
          showInteractive={false}
        />
        <MiniMap
          nodeColor="#FF6B2C33"
          maskColor="rgba(8,9,13,0.7)"
          style={{ background: '#12151C', border: '1px solid #1F2430' }}
        />
      </ReactFlow>
    </div>
  )
}
