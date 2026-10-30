import type { DataProfile, ColumnProfile } from '../types/pipeline'

export interface ProfilerService {
  profileCSV(file: File): Promise<DataProfile>
}

// ── Mock: parse first line for headers, guess types from name, generate stats ─
export const mockProfiler: ProfilerService = {
  async profileCSV(file: File): Promise<DataProfile> {
    const text = await file.text()
    const lines = text.trim().split('\n').filter(Boolean)
    const rows = lines.length - 1
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))

    // Sample up to 200 data rows for heuristics
    const sampleLines = lines.slice(1, 201)
    const columns: ColumnProfile[] = headers.map((name, colIdx) => {
      const values = sampleLines
        .map((l) => l.split(',')[colIdx]?.trim().replace(/^"|"$/g, '') ?? '')

      const missing = values.filter((v) => v === '' || v.toLowerCase() === 'nan' || v.toLowerCase() === 'null').length
      const missing_pct = parseFloat(((missing / Math.max(values.length, 1)) * 100).toFixed(1))

      const numericValues = values.filter((v) => v !== '' && !isNaN(Number(v))).map(Number)
      const isNumeric = numericValues.length > values.length * 0.7
      const isBool = new Set(values.map((v) => v.toLowerCase())).size <= 2 &&
        values.every((v) => ['0', '1', 'true', 'false', 'yes', 'no', ''].includes(v.toLowerCase()))

      const type: ColumnProfile['type'] = isBool ? 'boolean' : isNumeric ? 'numeric' : 'categorical'

      let skew: number | undefined
      let unique: number | undefined
      let imbalance_ratio: number | undefined

      if (type === 'numeric' && numericValues.length > 2) {
        const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        const variance = numericValues.reduce((a, b) => a + (b - mean) ** 2, 0) / numericValues.length
        const std = Math.sqrt(variance)
        if (std > 0) {
          const skewRaw = numericValues.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / numericValues.length
          skew = parseFloat(skewRaw.toFixed(2))
        }
      }

      if (type === 'categorical' || type === 'boolean') {
        const counts = new Map<string, number>()
        for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
        unique = counts.size
        if (counts.size === 2) {
          const [a, b] = [...counts.values()]
          imbalance_ratio = parseFloat((Math.max(a, b) / Math.min(a, b)).toFixed(2))
        }
      }

      return { name, type, missing_pct, skew, unique, imbalance_ratio }
    })

    return { filename: file.name, rows, cols: headers.length, columns }
  },
}
