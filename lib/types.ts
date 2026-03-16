// ── Graph Node & Edge Types ─────────────────────────────────────────

export interface FunctionNode {
  id: string
  name: string
  filePath: string
  lineNumber: number
  params: string[]
  returnType?: string
  body: string
  annotation?: string
  annotationLoading?: boolean
  layer: NodeLayer
  complexity: number
  isExported: boolean
  isDeadCode?: boolean
}

export interface FileNode {
  id: string
  filePath: string
  language: string
  loc: number
  imports: string[]
  exports: string[]
  complexity: number
  annotation?: string
  annotationLoading?: boolean
  fileType: FileType
  functions: FunctionNode[]
}

export interface RouteNode {
  id: string
  method: string
  path: string
  handlerName: string
  filePath: string
  lineNumber: number
  annotation?: string
  framework: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
  type: EdgeType
}

// ── Enums ───────────────────────────────────────────────────────────

export type NodeLayer =
  | 'route'
  | 'middleware'
  | 'controller'
  | 'service'
  | 'data'
  | 'utility'
  | 'test'
  | 'config'
  | 'component'
  | 'unknown'

export type FileType =
  | 'route'
  | 'component'
  | 'utility'
  | 'test'
  | 'config'
  | 'model'
  | 'service'
  | 'middleware'
  | 'unknown'

export type EdgeType = 'import' | 'call' | 'route-flow'

export type VisualizationMode = 'route-tracer' | 'module-map' | 'call-graph'

// ── Analysis Results ────────────────────────────────────────────────

export interface AnalysisResult {
  id: string
  owner: string
  repo: string
  branch: string
  commitSha: string
  language: string
  files: FileNode[]
  modules: ModuleGraph
  routes: RouteNode[]
  status: AnalysisStatus
  createdAt: string
}

export interface ModuleGraph {
  nodes: FileNode[]
  edges: GraphEdge[]
  clusters: Cluster[]
}

export interface FunctionGraph {
  nodes: FunctionNode[]
  edges: GraphEdge[]
}

export interface RouteTrace {
  route: RouteNode
  chain: FunctionNode[]
  edges: GraphEdge[]
}

export interface Cluster {
  id: string
  label: string
  color: string
  files: string[]
}

export type AnalysisStatus =
  | 'cloning'
  | 'parsing'
  | 'analyzing'
  | 'annotating'
  | 'complete'
  | 'error'

export interface AnalysisProgress {
  status: AnalysisStatus
  progress: number // 0-100
  message: string
  filesProcessed?: number
  totalFiles?: number
}

// ── API Request/Response Types ──────────────────────────────────────

export interface AnalyzeRequest {
  repoUrl: string
}

export interface AnalyzeResponse {
  id: string
  owner: string
  repo: string
}

export interface AnnotationRequest {
  functionIds: string[]
}
