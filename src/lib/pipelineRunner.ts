import type { PipelineBlock, RunResults, EpochMetric } from '../types/pipeline'
import { createPipeline, toApiPipelineBlocks, trainPipeline } from '../api/client'

export interface RunnerCallbacks {
  onEpoch: (epoch: number, metric: EpochMetric) => void
  onDone: (results: RunResults) => void
  onError?: (message: string) => void
}

/** Train the pipeline through the backend SSE endpoint with real weights. */
export function runPipeline(
  blocks: PipelineBlock[],
  callbacks: RunnerCallbacks,
  datasetId: number | null = null,
  pipelineName = 'ModelForge Pipeline',
): () => void {
  if (datasetId === null) {
    callbacks.onError?.('Upload a dataset or load a sample dataset before running the pipeline.')
    return () => undefined
  }

  const controller = new AbortController()
  const metricHistory: EpochMetric[] = []
  const target = String(blocks.find((block) => block.type === 'dataset')?.params.target_column ?? '')
  void createPipeline(pipelineName, datasetId, toApiPipelineBlocks(blocks)).then(({ id }) =>
    trainPipeline(id, target, controller.signal, (metric) => {
      const epoch: EpochMetric = { epoch: metric.iteration, accuracy: metric.accuracy, loss: metric.loss }
      metricHistory.push(epoch)
      callbacks.onEpoch(metric.iteration, epoch)
    })
  ).then(({ runId, metric }) => {
    callbacks.onDone({
      runId,
      accuracy: metric.accuracy,
      precision: metric.precision,
      f1: metric.f1,
      loss: metric.loss,
      epochMetrics: metricHistory,
      confusionMatrix: metric.confusion_matrix,
    })
  }).catch((error: unknown) => {
    if (!controller.signal.aborted) callbacks.onError?.(error instanceof Error ? error.message : 'Training failed')
  })
  return () => controller.abort()
}
