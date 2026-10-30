import type { PipelineBlock } from '../types/pipeline'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `API request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export interface ApiDataset { id: number; name: string; filename: string; size_bytes: number }
export interface ApiPipelineBlock { id: string; type: string; params: Record<string, string | number | boolean | null> }
export interface ApiPipelineInput { name: string; dataset_id: number; blocks: ApiPipelineBlock[] }
interface ApiProfile {
  dataset_id: number; rows: number; columns: number
  column_profiles: Array<{ name: string; inferred_type: string; missing_percent: number; skew: number | null; cardinality: number }>
}
interface ApiSuggestion { id: string; severity: string; title: string; text: string; fix_block: { type: string; params: Record<string, unknown> } }

export async function uploadDataset(file: File): Promise<ApiDataset> {
  return request(`/datasets?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: file,
  })
}

export async function getDatasetProfile(id: number, filename: string) {
  const profile = await request<ApiProfile>(`/datasets/${id}/profile`)
  return {
    filename, rows: profile.rows, cols: profile.columns,
    columns: profile.column_profiles.map((column) => ({
      name: column.name,
      type: column.inferred_type === 'numeric' ? 'numeric' as const : column.inferred_type === 'boolean' ? 'boolean' as const : 'categorical' as const,
      missing_pct: column.missing_percent, skew: column.skew ?? undefined, unique: column.cardinality,
    })),
  }
}

export function getDatasetSuggestions(id: number) {
  return request<ApiSuggestion[]>(`/datasets/${id}/suggestions`)
}

export async function createPipeline(name: string, datasetId: number, blocks: ApiPipelineBlock[]): Promise<{ id: number }> {
  return request('/pipelines', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dataset_id: datasetId, blocks }) })
}

export async function savePipelineSpec(input: ApiPipelineInput, pipelineId: number | null): Promise<number> {
  const path = pipelineId === null ? '/pipelines' : `/pipelines/${pipelineId}`
  const result = await request<{ id: number }>(path, {
    method: pipelineId === null ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.id
}

export async function fetchGeneratedCode(pipelineId: number, targetColumn: string): Promise<string> {
  const result = await request<{ code: string }>(`/pipelines/${pipelineId}/code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_column: targetColumn }),
  })
  return result.code
}

export async function validateCustomCode(code: string): Promise<void> {
  await request<{ valid: boolean }>('/custom-code/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
  })
}

export function toApiPipelineBlocks(blocks: PipelineBlock[]): ApiPipelineBlock[] {
  const types: Record<string, string> = {
    missing_values: 'Missing Values', scaling: 'Scaling', encoding: 'Encoding', outliers: 'Outliers',
    random_forest: 'Random Forest', xgboost: 'XGBoost', logistic_regression: 'Logistic Regression', svm: 'SVM',
  }
  const parameterNames: Record<string, string[]> = {
    missing_values: ['strategy', 'fill_value'], scaling: [], encoding: [], outliers: ['method', 'threshold'],
    random_forest: ['n_estimators', 'max_depth'], xgboost: ['n_estimators', 'max_depth', 'learning_rate'],
    logistic_regression: ['C', 'max_iter'], svm: ['C', 'kernel'],
  }
  return blocks.flatMap((block) => {
    const blockParams = block.params as Record<string, unknown>
    if (block.type === 'dataset' && block.params.test_size !== undefined) {
      return [{ id: block.id, type: 'Train/Test Split', params: { test_size: block.params.test_size } }]
    }
    const type = types[block.type]
    if (!type) return []
    const params: ApiPipelineBlock['params'] = {}
    for (const key of parameterNames[block.type] ?? []) {
      const value = blockParams[key]
      if (value !== undefined && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null)) params[key] = value
    }
    if (block.type === 'scaling') params.method = String(blockParams.scaler ?? 'standard')
    if (block.type === 'encoding') params.method = String(blockParams.encoding ?? 'onehot')
    return [{ id: block.id, type, params }]
  })
}

export async function trainPipeline(pipelineId: number, targetColumn: string, signal: AbortSignal,
  onMetric: (metric: { iteration: number; accuracy: number; loss: number; precision: number; f1: number; confusion_matrix: number[][] }) => void) {
  const response = await fetch(`${API_BASE}/pipelines/${pipelineId}/train`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ target_column: targetColumn }), signal,
  })
  if (!response.ok || !response.body) throw new Error(`Training request failed (${response.status})`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastMetric: { iteration: number; accuracy: number; loss: number; precision: number; f1: number; confusion_matrix: number[][] } | null = null
  while (true) {
    const { value, done } = await reader.read()
    buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n')
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      const type = event.match(/^event:\s*(.+)$/m)?.[1]
      const data = event.match(/^data:\s*(.+)$/m)?.[1]
      if (!type || !data) continue
      const parsed = JSON.parse(data)
      if (type === 'metric') { lastMetric = parsed; onMetric(parsed) }
      if (type === 'error') throw new Error(parsed.message ?? 'Training failed')
      if (type === 'complete') {
        if (!lastMetric) throw new Error('Training completed without metrics')
        return { runId: parsed.run_id, metric: lastMetric }
      }
    }
    if (done) break
  }
  throw new Error('Training stream ended unexpectedly')
}
