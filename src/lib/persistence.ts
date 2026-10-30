// ── localStorage persistence helpers ────────────────────────────────────────

const STORAGE_KEY = 'modelforge:pipeline:v1'

import type { PipelineBlock, CanvasNode, CanvasEdge } from '../types/pipeline'

export interface PersistedPipeline {
  projectName: string
  blocks: PipelineBlock[]
  canvasNodes: CanvasNode[]
  canvasEdges: CanvasEdge[]
  savedAt: string
}

export function savePipeline(data: PersistedPipeline): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage may be unavailable (private browsing quota, etc.)
  }
}

export function loadPipeline(): PersistedPipeline | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedPipeline
  } catch {
    return null
  }
}

export function clearPipeline(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
