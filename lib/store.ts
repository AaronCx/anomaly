import type { AnalysisResult, AnalysisStatus, AnalysisProgress } from './types'

const analyses = new Map<string, AnalysisResult>()
const progressMap = new Map<string, AnalysisProgress>()

export function getAnalysis(id: string): AnalysisResult | undefined {
  return analyses.get(id)
}

export function setAnalysis(id: string, result: AnalysisResult): void {
  analyses.set(id, result)
}

export function updateAnalysisStatus(
  id: string,
  status: AnalysisStatus,
  progress: number,
  message?: string,
  filesProcessed?: number,
  totalFiles?: number
): void {
  const analysis = analyses.get(id)
  if (analysis) {
    analysis.status = status
  }

  progressMap.set(id, {
    status,
    progress,
    message: message ?? status,
    filesProcessed,
    totalFiles,
  })
}

export function getProgress(id: string): AnalysisProgress | undefined {
  return progressMap.get(id)
}

export function deleteAnalysis(id: string): void {
  analyses.delete(id)
  progressMap.delete(id)
}
