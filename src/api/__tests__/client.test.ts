import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGeneratedCode, savePipelineSpec, toApiPipelineBlocks } from '../client'
import type { PipelineBlock } from '../../types/pipeline'

afterEach(() => vi.unstubAllGlobals())

describe('backend pipeline code generation', () => {
  it('serializes the JSON block spec to the backend block catalog', () => {
    const blocks: PipelineBlock[] = [
      { id: 'data', type: 'dataset', label: 'Dataset', params: { target_column: 'label', test_size: 0.25 } },
      { id: 'scale', type: 'scaling', label: 'Scale', params: { scaler: 'minmax' } },
      { id: 'model', type: 'random_forest', label: 'Forest', params: { n_estimators: 20, max_depth: 5 } },
      { id: 'eval', type: 'evaluate', label: 'Evaluate', params: {} },
    ]
    expect(toApiPipelineBlocks(blocks)).toEqual([
      { id: 'data', type: 'Train/Test Split', params: { test_size: 0.25 } },
      { id: 'scale', type: 'Scaling', params: { method: 'minmax' } },
      { id: 'model', type: 'Random Forest', params: { n_estimators: 20, max_depth: 5 } },
    ])
  })

  it('persists a pipeline and requests its generated code from the backend', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7 }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: '# backend output' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const input = { name: 'QA', dataset_id: 2, blocks: [{ id: 'model', type: 'Random Forest', params: {} }] }
    const id = await savePipelineSpec(input, null)
    const code = await fetchGeneratedCode(id, 'label')
    expect(id).toBe(7)
    expect(code).toBe('# backend output')
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8000/api/pipelines',
      'http://localhost:8000/api/pipelines/7/code',
    ])
  })
})
