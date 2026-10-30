import { create } from 'zustand'
import { nanoid } from './lib/nanoid'
import type {
  PipelineBlock,
  BlockType,
  BlockParams,
  CanvasNode,
  CanvasEdge,
  RunResults,
  DataProfile,
  Suggestion,
} from './types/pipeline'
import { CATALOG_BY_TYPE } from './types/catalog'

interface PipelineStore {
  // ── Core spec (single source of truth) ──
  blocks: PipelineBlock[]
  canvasNodes: CanvasNode[]
  canvasEdges: CanvasEdge[]

  // ── UI state ──
  selectedBlockId: string | null
  transparencyMode: boolean
  showCode: boolean
  isRunning: boolean
  runResults: RunResults | null
  currentEpoch: number
  totalEpochs: number

  // ── Dataset / profiler ──
  dataProfile: DataProfile | null
  suggestions: Suggestion[]

  // ── Project ──
  projectName: string

  // ── Actions ──
  addBlock: (type: BlockType, position?: { x: number; y: number }) => string
  removeBlock: (id: string) => void
  updateBlockParams: (id: string, params: Partial<BlockParams>) => void
  selectBlock: (id: string | null) => void
  reorderBlocks: (fromIdx: number, toIdx: number) => void

  addEdge: (source: string, target: string) => void
  removeEdge: (id: string) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void

  setDataProfile: (profile: DataProfile) => void
  setSuggestions: (suggestions: Suggestion[]) => void
  answerSuggestion: (id: string, accepted: boolean) => void

  setRunResults: (results: RunResults) => void
  setIsRunning: (v: boolean) => void
  setCurrentEpoch: (epoch: number) => void
  clearResults: () => void

  setTransparencyMode: (v: boolean) => void
  setShowCode: (v: boolean) => void
  setProjectName: (name: string) => void
}

// Default starter pipeline so canvas isn't empty
const DEFAULT_BLOCKS: PipelineBlock[] = [
  { id: 'b1', type: 'dataset', label: 'Load Dataset', params: { target_column: 'target', test_size: 0.2 } },
  { id: 'b2', type: 'missing_values', label: 'Handle Missing Values', params: { strategy: 'median' } },
  { id: 'b3', type: 'scaling', label: 'Feature Scaling', params: { scaler: 'standard' } },
  { id: 'b4', type: 'random_forest', label: 'Random Forest', params: { n_estimators: 100, max_depth: 10 } },
  { id: 'b5', type: 'evaluate', label: 'Evaluate & Metrics', params: {} },
]

const DEFAULT_NODES: CanvasNode[] = [
  { id: 'b1', position: { x: 60, y: 200 } },
  { id: 'b2', position: { x: 280, y: 200 } },
  { id: 'b3', position: { x: 500, y: 200 } },
  { id: 'b4', position: { x: 720, y: 200 } },
  { id: 'b5', position: { x: 940, y: 200 } },
]

const DEFAULT_EDGES: CanvasEdge[] = [
  { id: 'e1', source: 'b1', target: 'b2' },
  { id: 'e2', source: 'b2', target: 'b3' },
  { id: 'e3', source: 'b3', target: 'b4' },
  { id: 'e4', source: 'b4', target: 'b5' },
]

export const usePipelineStore = create<PipelineStore>((set) => ({
  blocks: DEFAULT_BLOCKS,
  canvasNodes: DEFAULT_NODES,
  canvasEdges: DEFAULT_EDGES,
  selectedBlockId: null,
  transparencyMode: true,
  showCode: true,
  isRunning: false,
  runResults: null,
  currentEpoch: 0,
  totalEpochs: 200,
  dataProfile: null,
  suggestions: [],
  projectName: 'Credit Default Prediction',

  addBlock: (type, position) => {
    const id = nanoid()
    const catalog = CATALOG_BY_TYPE[type]
    const block: PipelineBlock = {
      id,
      type,
      label: catalog.label,
      params: { ...catalog.defaultParams },
    }
    const node: CanvasNode = {
      id,
      position: position ?? { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
    }
    set((s) => ({
      blocks: [...s.blocks, block],
      canvasNodes: [...s.canvasNodes, node],
    }))
    return id
  },

  removeBlock: (id) =>
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== id),
      canvasNodes: s.canvasNodes.filter((n) => n.id !== id),
      canvasEdges: s.canvasEdges.filter((e) => e.source !== id && e.target !== id),
      selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId,
    })),

  updateBlockParams: (id, params) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, params: { ...b.params, ...params } } : b
      ),
    })),

  selectBlock: (id) => set({ selectedBlockId: id }),

  reorderBlocks: (fromIdx, toIdx) =>
    set((s) => {
      const blocks = [...s.blocks]
      const [moved] = blocks.splice(fromIdx, 1)
      blocks.splice(toIdx, 0, moved)
      return { blocks }
    }),

  addEdge: (source, target) => {
    const id = `e-${nanoid()}`
    set((s) => ({
      canvasEdges: [...s.canvasEdges, { id, source, target }],
    }))
  },

  removeEdge: (id) =>
    set((s) => ({ canvasEdges: s.canvasEdges.filter((e) => e.id !== id) })),

  updateNodePosition: (id, position) =>
    set((s) => ({
      canvasNodes: s.canvasNodes.map((n) => (n.id === id ? { ...n, position } : n)),
    })),

  setDataProfile: (profile) => set({ dataProfile: profile }),
  setSuggestions: (suggestions) => set({ suggestions }),

  answerSuggestion: (id, accepted) =>
    set((s) => ({
      suggestions: s.suggestions.map((sg) =>
        sg.id === id ? { ...sg, accepted } : sg
      ),
    })),

  setRunResults: (results) => set({ runResults: results }),
  setIsRunning: (v) => set({ isRunning: v }),
  setCurrentEpoch: (epoch) => set({ currentEpoch: epoch }),
  clearResults: () => set({ runResults: null, currentEpoch: 0 }),

  setTransparencyMode: (v) => set({ transparencyMode: v }),
  setShowCode: (v) => set({ showCode: v }),
  setProjectName: (name) => set({ projectName: name }),
}))
