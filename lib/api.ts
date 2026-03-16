import type {
  AnalyzeResponse,
  AnalysisResult,
  AnalysisProgress,
  ModuleGraph,
  RouteNode,
  RouteTrace,
  FunctionGraph,
} from './types'

const API_BASE = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function analyzeRepo(repoUrl: string): Promise<AnalyzeResponse> {
  return fetchJSON<AnalyzeResponse>(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl }),
  })
}

export async function getAnalysisStatus(id: string): Promise<AnalysisProgress> {
  return fetchJSON<AnalysisProgress>(`${API_BASE}/analysis/${id}/status`)
}

export async function getAnalysis(id: string): Promise<AnalysisResult> {
  return fetchJSON<AnalysisResult>(`${API_BASE}/analysis/${id}/status`)
}

export async function getModuleGraph(id: string): Promise<ModuleGraph> {
  return fetchJSON<ModuleGraph>(`${API_BASE}/analysis/${id}/modules`)
}

export async function getRoutes(id: string): Promise<RouteNode[]> {
  return fetchJSON<RouteNode[]>(`${API_BASE}/analysis/${id}/routes`)
}

export async function traceRoute(id: string, routePath: string): Promise<RouteTrace> {
  return fetchJSON<RouteTrace>(`${API_BASE}/analysis/${id}/trace/${encodeURIComponent(routePath)}`)
}

export async function getFunctionGraph(id: string, filePath: string): Promise<FunctionGraph> {
  return fetchJSON<FunctionGraph>(`${API_BASE}/analysis/${id}/functions/${encodeURIComponent(filePath)}`)
}

export async function triggerAnnotations(id: string, functionIds: string[]): Promise<void> {
  await fetchJSON(`${API_BASE}/analysis/${id}/annotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ functionIds }),
  })
}

export async function getAnnotations(id: string): Promise<Record<string, string>> {
  return fetchJSON<Record<string, string>>(`${API_BASE}/analysis/${id}/annotations`)
}
