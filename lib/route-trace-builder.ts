import type { RouteNode, RouteTrace, FunctionNode, GraphEdge } from './types'
import type { ParsedFile } from './parser'
import { classifyFunctionLayer, estimateFunctionComplexity } from './module-analyzer'
import { generateId } from './utils'

/**
 * Given a route, trace the full execution chain:
 * Route Handler → Middleware → Controller → Service → DB Query
 *
 * Walks from the route handler through call expressions across files,
 * classifying each function in the chain by layer.
 */
export function buildRouteTrace(
  route: RouteNode,
  parsedFiles: Map<string, ParsedFile>
): RouteTrace {
  const visited = new Set<string>()
  const chain: FunctionNode[] = []
  const edges: GraphEdge[] = []

  // Find the handler function in the route's file
  const parsed = parsedFiles.get(route.filePath)
  if (!parsed) {
    return { route, chain: [], edges: [] }
  }

  const handlerFn = parsed.functions.find((f) => f.name === route.handlerName)
  if (!handlerFn) {
    // Still create a placeholder node for the route handler
    const placeholderNode: FunctionNode = {
      id: `${route.filePath}::${route.handlerName}`,
      name: route.handlerName,
      filePath: route.filePath,
      lineNumber: route.lineNumber,
      params: [],
      body: '',
      layer: 'route',
      complexity: 1,
      isExported: true,
    }
    return { route, chain: [placeholderNode], edges: [] }
  }

  // Start tracing from the handler
  const startNode: FunctionNode = {
    id: `${route.filePath}::${handlerFn.name}`,
    name: handlerFn.name,
    filePath: route.filePath,
    lineNumber: handlerFn.line,
    params: handlerFn.params,
    body: handlerFn.body,
    layer: 'route',
    complexity: estimateFunctionComplexity(handlerFn.body),
    isExported: handlerFn.isExported,
  }

  traceFunction(startNode, route.filePath, parsedFiles, visited, chain, edges, 0)

  return { route, chain, edges }
}

const MAX_TRACE_DEPTH = 15

function traceFunction(
  node: FunctionNode,
  currentFile: string,
  parsedFiles: Map<string, ParsedFile>,
  visited: Set<string>,
  chain: FunctionNode[],
  edges: GraphEdge[],
  depth: number
): void {
  if (depth > MAX_TRACE_DEPTH) return
  if (visited.has(node.id)) return

  visited.add(node.id)
  chain.push(node)

  const parsed = parsedFiles.get(currentFile)
  if (!parsed) return

  // Find all calls made by this function
  const calls = parsed.callExpressions.filter(
    (c) => c.callerFunction === node.name
  )

  // Build import resolution for this file
  const importMap = buildLocalImportMap(currentFile, parsed, parsedFiles)

  for (const call of calls) {
    if (isBuiltinCall(call.calleeName)) continue

    const resolution = resolveCall(
      call.calleeName,
      currentFile,
      parsed,
      parsedFiles,
      importMap
    )

    if (!resolution) continue

    const targetId = `${resolution.filePath}::${resolution.functionName}`
    if (visited.has(targetId)) {
      // Still add the edge for visualization even if we don't recurse
      edges.push({
        id: generateId(),
        source: node.id,
        target: targetId,
        label: call.calleeName,
        type: 'route-flow',
      })
      continue
    }

    const targetParsed = parsedFiles.get(resolution.filePath)
    const targetFnDef = targetParsed?.functions.find(
      (f) => f.name === resolution.functionName
    )

    const targetNode: FunctionNode = {
      id: targetId,
      name: resolution.functionName,
      filePath: resolution.filePath,
      lineNumber: targetFnDef?.line ?? call.line,
      params: targetFnDef?.params ?? [],
      body: targetFnDef?.body ?? '',
      layer: classifyFunctionLayer(resolution.functionName, resolution.filePath),
      complexity: targetFnDef
        ? estimateFunctionComplexity(targetFnDef.body)
        : 1,
      isExported: targetFnDef?.isExported ?? true,
    }

    edges.push({
      id: generateId(),
      source: node.id,
      target: targetId,
      label: call.calleeName,
      type: 'route-flow',
    })

    traceFunction(
      targetNode,
      resolution.filePath,
      parsedFiles,
      visited,
      chain,
      edges,
      depth + 1
    )
  }
}

interface ImportEntry {
  localName: string
  sourceFile: string
  originalName: string
}

function buildLocalImportMap(
  currentFile: string,
  parsed: ParsedFile,
  parsedFiles: Map<string, ParsedFile>
): ImportEntry[] {
  const entries: ImportEntry[] = []

  for (const imp of parsed.imports) {
    if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) continue

    const resolvedFile = resolveImportPath(currentFile, imp.source, parsedFiles)
    if (!resolvedFile) continue

    for (const spec of imp.specifiers) {
      entries.push({
        localName: spec === 'default' ? imp.source.split('/').pop()! : spec,
        sourceFile: resolvedFile,
        originalName: spec,
      })
    }
  }

  return entries
}

interface CallResolution {
  filePath: string
  functionName: string
}

function resolveCall(
  calleeName: string,
  currentFile: string,
  currentParsed: ParsedFile,
  parsedFiles: Map<string, ParsedFile>,
  importMap: ImportEntry[]
): CallResolution | null {
  const simpleName = calleeName.includes('.')
    ? calleeName.split('.')[0]
    : calleeName

  // Check local functions
  const localFn = currentParsed.functions.find((f) => f.name === calleeName)
  if (localFn) {
    return { filePath: currentFile, functionName: calleeName }
  }

  // Check imports
  const imp = importMap.find((r) => r.localName === simpleName)
  if (imp) {
    const targetName = calleeName.includes('.')
      ? calleeName.split('.').slice(1).join('.')
      : imp.originalName === 'default'
        ? calleeName
        : imp.originalName
    return { filePath: imp.sourceFile, functionName: targetName }
  }

  return null
}

function resolveImportPath(
  fromFile: string,
  importSource: string,
  parsedFiles: Map<string, ParsedFile>
): string | null {
  if (!importSource.startsWith('.')) return null

  const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'))
  const resolved = normalizePath(fromDir + '/' + importSource)

  const extensions = [
    '', '.ts', '.tsx', '.js', '.jsx',
    '/index.ts', '/index.tsx', '/index.js', '/index.jsx',
  ]

  for (const ext of extensions) {
    const candidate = resolved + ext
    if (parsedFiles.has(candidate)) return candidate
  }

  return null
}

function normalizePath(path: string): string {
  const parts = path.split('/')
  const result: string[] = []
  for (const part of parts) {
    if (part === '..') result.pop()
    else if (part !== '.' && part !== '') result.push(part)
  }
  return result.join('/')
}

function isBuiltinCall(name: string): boolean {
  const builtins = new Set([
    'console.log', 'console.error', 'console.warn', 'console.info',
    'JSON.parse', 'JSON.stringify',
    'Object.keys', 'Object.values', 'Object.entries', 'Object.assign',
    'Array.isArray', 'Array.from',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'Promise.all', 'Promise.allSettled', 'Promise.race',
    'Promise.resolve', 'Promise.reject',
    'require', 'import',
    'encodeURIComponent', 'decodeURIComponent',
  ])
  return builtins.has(name)
}
