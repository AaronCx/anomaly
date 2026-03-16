import type {
  FileNode,
  FileType,
  GraphEdge,
  ModuleGraph,
  Cluster,
  FunctionNode,
  NodeLayer,
} from './types'
import type { ParsedFile } from './parser'
import { generateId, getFileExtension, getLanguageFromExt } from './utils'

/**
 * Build a complete module dependency graph from parsed files.
 */
export function buildModuleGraph(
  parsedFiles: Map<string, ParsedFile>,
  fileContents: Map<string, string>
): ModuleGraph {
  const nodes = buildFileNodes(parsedFiles, fileContents)
  const edges = buildDependencyEdges(parsedFiles, nodes)
  const clusters = detectClusters(nodes, edges)

  return { nodes, edges, clusters }
}

function buildFileNodes(
  parsedFiles: Map<string, ParsedFile>,
  fileContents: Map<string, string>
): FileNode[] {
  const nodes: FileNode[] = []

  for (const [filePath, parsed] of parsedFiles) {
    const content = fileContents.get(filePath) ?? ''
    const ext = getFileExtension(filePath)
    const loc = content.split('\n').length
    const complexity = calculateFileComplexity(parsed)
    const fileType = classifyFile(filePath)

    const functions: FunctionNode[] = parsed.functions.map((fn) => ({
      id: `${filePath}::${fn.name}`,
      name: fn.name,
      filePath,
      lineNumber: fn.line,
      params: fn.params,
      returnType: fn.returnType,
      body: fn.body,
      layer: classifyFunctionLayer(fn.name, filePath),
      complexity: estimateFunctionComplexity(fn.body),
      isExported: fn.isExported,
    }))

    nodes.push({
      id: filePath,
      filePath,
      language: getLanguageFromExt(ext),
      loc,
      imports: parsed.imports.map((i) => i.source),
      exports: parsed.exports,
      complexity,
      fileType,
      functions,
    })
  }

  return nodes
}

function buildDependencyEdges(
  parsedFiles: Map<string, ParsedFile>,
  nodes: FileNode[]
): GraphEdge[] {
  const edges: GraphEdge[] = []
  const filePathSet = new Set(nodes.map((n) => n.filePath))

  for (const [filePath, parsed] of parsedFiles) {
    for (const imp of parsed.imports) {
      const resolvedTarget = resolveImportPath(filePath, imp.source, filePathSet)
      if (resolvedTarget) {
        edges.push({
          id: generateId(),
          source: filePath,
          target: resolvedTarget,
          label: imp.specifiers.join(', '),
          type: 'import',
        })
      }
    }
  }

  return edges
}

/**
 * Resolve a relative import to a file in our set.
 * Handles: ./foo, ../foo, with/without extensions, index files.
 */
function resolveImportPath(
  fromFile: string,
  importSource: string,
  knownFiles: Set<string>
): string | null {
  // Skip external packages
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    return null
  }

  const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'))
  const resolved = normalizePath(fromDir + '/' + importSource)

  // Try exact match, then with extensions, then as directory/index
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']

  for (const ext of extensions) {
    const candidate = resolved + ext
    if (knownFiles.has(candidate)) {
      return candidate
    }
  }

  return null
}

function normalizePath(path: string): string {
  const parts = path.split('/')
  const result: string[] = []

  for (const part of parts) {
    if (part === '..') {
      result.pop()
    } else if (part !== '.' && part !== '') {
      result.push(part)
    }
  }

  return result.join('/')
}

/**
 * Classify a file by type based on path heuristics.
 */
export function classifyFile(filePath: string): FileType {
  const lower = filePath.toLowerCase()
  const parts = lower.split('/')

  // Test files
  if (
    parts.some((p) => p === 'test' || p === 'tests' || p === '__tests__') ||
    lower.includes('.test.') ||
    lower.includes('.spec.')
  ) {
    return 'test'
  }

  // Config files
  if (
    parts.some((p) => p === 'config' || p === 'configs') ||
    lower.includes('.config.') ||
    lower.includes('tailwind') ||
    lower.includes('eslint') ||
    lower.includes('prettier') ||
    lower.includes('tsconfig') ||
    lower.includes('next.config')
  ) {
    return 'config'
  }

  // Route files
  if (
    parts.some((p) => p === 'routes' || p === 'api') ||
    lower.includes('route.') ||
    lower.includes('router.')
  ) {
    return 'route'
  }

  // Middleware
  if (
    parts.some((p) => p === 'middleware' || p === 'middlewares') ||
    lower.includes('middleware')
  ) {
    return 'middleware'
  }

  // Models
  if (
    parts.some((p) => p === 'models' || p === 'entities' || p === 'schemas') ||
    lower.includes('model.') ||
    lower.includes('schema.') ||
    lower.includes('entity.')
  ) {
    return 'model'
  }

  // Services
  if (
    parts.some((p) => p === 'services' || p === 'lib') ||
    lower.includes('service.')
  ) {
    return 'service'
  }

  // Components
  if (
    parts.some((p) => p === 'components' || p === 'ui' || p === 'views' || p === 'pages') ||
    lower.includes('component.')
  ) {
    return 'component'
  }

  // Utilities
  if (
    parts.some((p) => p === 'utils' || p === 'helpers' || p === 'util') ||
    lower.includes('util.') ||
    lower.includes('helper.')
  ) {
    return 'utility'
  }

  return 'unknown'
}

/**
 * Calculate total cyclomatic complexity for a file from its parsed AST data.
 */
function calculateFileComplexity(parsed: ParsedFile): number {
  let complexity = 1 // Base complexity

  for (const fn of parsed.functions) {
    complexity += estimateFunctionComplexity(fn.body)
  }

  return complexity
}

/**
 * Estimate cyclomatic complexity from function body text.
 * Counts decision points: if, else if, for, while, switch, case, &&, ||, ?.
 */
export function estimateFunctionComplexity(body: string): number {
  let complexity = 1

  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /&&/g,
    /\|\|/g,
    /\?\./g,  // optional chaining adds a branch
    /\btry\s*\{/g,
    /\bcatch\s*\(/g,
  ]

  for (const pattern of patterns) {
    const matches = body.match(pattern)
    if (matches) {
      complexity += matches.length
    }
  }

  return complexity
}

/**
 * Classify a function by its layer based on name and file path.
 */
export function classifyFunctionLayer(name: string, filePath: string): NodeLayer {
  const lower = name.toLowerCase()
  const fileType = classifyFile(filePath)

  // Map file type to layer for some cases
  if (fileType === 'test') return 'test'
  if (fileType === 'config') return 'config'
  if (fileType === 'component') return 'component'
  if (fileType === 'middleware') return 'middleware'

  // Route handlers
  if (
    fileType === 'route' ||
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(name)
  ) {
    return 'route'
  }

  // Data access patterns
  if (
    lower.startsWith('get') ||
    lower.startsWith('find') ||
    lower.startsWith('fetch') ||
    lower.startsWith('query') ||
    lower.startsWith('select') ||
    lower.startsWith('insert') ||
    lower.startsWith('update') ||
    lower.startsWith('delete') ||
    lower.startsWith('create') ||
    lower.startsWith('save') ||
    lower.includes('repository') ||
    lower.includes('dao')
  ) {
    return 'data'
  }

  // Middleware patterns
  if (
    lower.includes('auth') ||
    lower.includes('validate') ||
    lower.includes('check') ||
    lower.includes('verify') ||
    lower.includes('guard') ||
    lower.includes('intercept')
  ) {
    return 'middleware'
  }

  // Service patterns
  if (
    lower.includes('service') ||
    lower.includes('process') ||
    lower.includes('handle') ||
    lower.includes('execute') ||
    lower.includes('run')
  ) {
    return 'service'
  }

  // Controller patterns
  if (lower.includes('controller') || lower.includes('handler')) {
    return 'controller'
  }

  // Utility patterns
  if (
    lower.includes('util') ||
    lower.includes('helper') ||
    lower.includes('format') ||
    lower.includes('parse') ||
    lower.includes('convert') ||
    lower.includes('transform') ||
    lower.includes('map') ||
    lower.includes('filter')
  ) {
    return 'utility'
  }

  // If in a service file, classify as service
  if (fileType === 'service') return 'service'

  return 'unknown'
}

/**
 * Simple community detection: group files that import each other heavily.
 * Uses a label propagation approach on the dependency graph.
 */
function detectClusters(nodes: FileNode[], edges: GraphEdge[]): Cluster[] {
  // Build adjacency
  const adjacency = new Map<string, Map<string, number>>()
  for (const node of nodes) {
    adjacency.set(node.filePath, new Map())
  }

  for (const edge of edges) {
    if (edge.type !== 'import') continue
    const srcAdj = adjacency.get(edge.source)
    const tgtAdj = adjacency.get(edge.target)
    if (srcAdj) srcAdj.set(edge.target, (srcAdj.get(edge.target) ?? 0) + 1)
    if (tgtAdj) tgtAdj.set(edge.source, (tgtAdj.get(edge.source) ?? 0) + 1)
  }

  // Group by top-level directory as initial clusters
  const dirClusters = new Map<string, string[]>()

  for (const node of nodes) {
    const parts = node.filePath.split('/')
    // Use the first meaningful directory
    const dir = parts.length > 1 ? parts[0] : 'root'
    if (!dirClusters.has(dir)) {
      dirClusters.set(dir, [])
    }
    dirClusters.get(dir)!.push(node.filePath)
  }

  const CLUSTER_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#84cc16',
    '#6366f1', '#14b8a6',
  ]

  const clusters: Cluster[] = []
  let colorIndex = 0

  for (const [dir, files] of dirClusters) {
    if (files.length === 0) continue

    clusters.push({
      id: generateId(),
      label: dir,
      color: CLUSTER_COLORS[colorIndex % CLUSTER_COLORS.length],
      files,
    })
    colorIndex++
  }

  return clusters
}
