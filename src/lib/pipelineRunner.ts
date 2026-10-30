import type { PipelineBlock, RunResults, EpochMetric } from '../types/pipeline'
import { createPipeline, trainPipeline } from '../api/client'

// ── Deterministic-ish seeded RNG (Mulberry32) ───────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ── Model-specific performance ceilings ────────────────────────────────────
const MODEL_PERF: Record<string, { maxAcc: number; minLoss: number; speed: number }> = {
  random_forest:       { maxAcc: 0.93, minLoss: 0.18, speed: 0.7 },
  xgboost:             { maxAcc: 0.95, minLoss: 0.14, speed: 0.6 },
  logistic_regression: { maxAcc: 0.87, minLoss: 0.28, speed: 1.0 },
  svm:                 { maxAcc: 0.90, minLoss: 0.22, speed: 0.8 },
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export interface RunnerCallbacks {
  onEpoch: (epoch: number, metric: EpochMetric) => void
  onDone: (results: RunResults) => void
  onError?: (message: string) => void
}

/**
 * Simulate a training run.
 * Returns a cancel function.
 */
export function runPipeline(
  blocks: PipelineBlock[],
  callbacks: RunnerCallbacks,
  datasetId: number | null = null,
  pipelineName = 'ModelForge Pipeline',
): () => void {
  if (datasetId === null) {
    callbacks.onError?.('Upload a dataset before running the pipeline.')
    return () => undefined
  }
  if (datasetId !== null) {
    const controller = new AbortController()
    const metricHistory: EpochMetric[] = []
    const target = String(blocks.find((block) => block.type === 'dataset')?.params.target_column ?? '')
    const typeMap: Record<string, string> = {
      missing_values: 'Missing Values', scaling: 'Scaling', encoding: 'Encoding', outliers: 'Outliers',
      random_forest: 'Random Forest', xgboost: 'XGBoost', logistic_regression: 'Logistic Regression', svm: 'SVM',
    }
    const paramMap: Record<string, string[]> = {
      missing_values: ['strategy', 'fill_value'], scaling: ['method'], encoding: ['method'], outliers: ['method', 'threshold'],
      random_forest: ['n_estimators', 'max_depth'], xgboost: ['n_estimators', 'max_depth', 'learning_rate'],
      logistic_regression: ['C', 'max_iter'], svm: ['C', 'kernel'],
    }
    const apiBlocks = blocks.flatMap((block) => {
      if (block.type === 'dataset' && block.params.test_size !== undefined) {
        return [{ id: block.id, type: 'Train/Test Split', params: { test_size: block.params.test_size } }]
      }
      const type = typeMap[block.type]
      if (!type) return []
      const params: Record<string, string | number | boolean | null> = {}
      for (const key of paramMap[block.type] ?? []) {
        const value = block.params[key as keyof typeof block.params]
        if (value !== undefined) params[key === 'method' && block.type === 'scaling' ? 'method' : key] = value as string | number | boolean | null
      }
      if (block.type === 'scaling') params.method = block.params.scaler ?? 'standard'
      if (block.type === 'encoding') params.method = block.params.encoding ?? 'onehot'
      return [{ id: block.id, type, params }]
    })
    void createPipeline(pipelineName, datasetId, apiBlocks).then(({ id }) =>
      trainPipeline(id, target, controller.signal, (metric) => {
        const epoch: EpochMetric = { epoch: metric.iteration, accuracy: metric.accuracy, loss: metric.loss }
        metricHistory.push(epoch)
        callbacks.onEpoch(metric.iteration, epoch)
      })
    ).then(({ metric }) => {
      const results: RunResults = { accuracy: metric.accuracy, precision: metric.precision, f1: metric.f1,
        loss: metric.loss, epochMetrics: metricHistory, confusionMatrix: metric.confusion_matrix }
      callbacks.onDone(results)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) callbacks.onError?.(error instanceof Error ? error.message : 'Training failed')
    })
    return () => controller.abort()
  }

  const modelBlock = blocks.find((b) =>
    ['random_forest', 'xgboost', 'logistic_regression', 'svm'].includes(b.type)
  )

  const modelType = modelBlock?.type ?? 'random_forest'
  const perf = MODEL_PERF[modelType] ?? MODEL_PERF.random_forest

  // More estimators → more epochs to simulate
  const nEst = (modelBlock?.params?.n_estimators ?? 100) as number
  const totalEpochs = Math.min(Math.max(Math.floor(nEst / 5), 20), 60)

  const seed = blocks.reduce((acc, b) => acc + b.id.charCodeAt(0), 42)
  const rand = mulberry32(seed)

  const hasScaling = blocks.some((b) => b.type === 'scaling')
  const hasEncoding = blocks.some((b) => b.type === 'encoding')
  const hasOutliers = blocks.some((b) => b.type === 'outliers')
  const hasMissing  = blocks.some((b) => b.type === 'missing_values')

  // Preprocessing bonus
  const bonus =
    (hasScaling  ? 0.015 : 0) +
    (hasEncoding ? 0.01  : 0) +
    (hasOutliers ? 0.005 : 0) +
    (hasMissing  ? 0.01  : 0)

  const finalAcc  = Math.min(perf.maxAcc + bonus, 0.99)
  const finalLoss = Math.max(perf.minLoss - bonus * 0.5, 0.05)

  const epochMetrics: EpochMetric[] = []
  let cancelled = false
  let timeoutId: ReturnType<typeof setTimeout>

  function tick(epoch: number) {
    if (cancelled) return

    // Noisy learning curve — fast early gains, asymptotic plateau
    const progress = epoch / totalEpochs
    const smoothT = 1 - Math.exp(-4 * progress) // exponential approach
    const noise = (rand() - 0.5) * 0.015

    const acc  = Math.max(0, Math.min(1, lerp(0.5, finalAcc,  smoothT) + noise))
    const loss = Math.max(0, lerp(2.3, finalLoss, smoothT) + (rand() - 0.5) * 0.08)

    const metric: EpochMetric = { epoch, accuracy: acc, loss }
    epochMetrics.push(metric)
    callbacks.onEpoch(epoch, metric)

    if (epoch < totalEpochs) {
      // Delay per epoch: faster at end (mimics actual training)
      const delay = Math.max(40, 100 - epoch * 1.2) / perf.speed
      timeoutId = setTimeout(() => tick(epoch + 1), delay)
    } else {
      // Training done — compute final results
      const confTP = Math.floor(finalAcc * 400 + rand() * 20)
      const confTN = Math.floor(finalAcc * 350 + rand() * 15)
      const confFP = Math.floor((1 - finalAcc) * 350 + rand() * 10)
      const confFN = Math.floor((1 - finalAcc) * 400 + rand() * 10)

      const precision = confTP / Math.max(confTP + confFP, 1)
      const recall    = confTP / Math.max(confTP + confFN, 1)
      const f1        = (2 * precision * recall) / Math.max(precision + recall, 1e-8)

      const results: RunResults = {
        accuracy: finalAcc + (rand() - 0.5) * 0.005,
        precision,
        f1,
        loss: finalLoss + (rand() - 0.5) * 0.01,
        epochMetrics,
        confusionMatrix: [
          [confTP, confFP],
          [confFN, confTN],
        ],
      }
      callbacks.onDone(results)
    }
  }

  // Start on next tick
  timeoutId = setTimeout(() => tick(1), 50)

  return () => {
    cancelled = true
    clearTimeout(timeoutId)
  }
}
