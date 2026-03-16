import type { FunctionNode, FunctionGraph, GraphEdge } from './types'
import type { ParsedFile } from './parser'
import { classifyFunctionLayer, estimateFunctionComplexity } from './module-analyzer'
import { generateId } from './utils'

/**
 * Build a function-level call graph for a specific file,
 * resolving call targets to definitions in the same file,
 * imported files, or marking as external.
 */
export function buildFunctionGraph(
  filePath: string,
  parsedFiles: Map<string, ParsedFile>
): FunctionGraph {
  const parsed = parsedFiles.get(filePath)
  if (!parsed) {
    return { nodes: [], edges: [] }
  }

  // Build function nodes for this file
  const nodes: FunctionNode[] = parsed.functions.map((fn) => ({
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

  // Build import resolution map: imported name → source file + original name
  const importMap = buildImportMap(parsed, parsedFiles)

  // Build edges from call expressions
  const edges: GraphEdge[] = []
  const nodeIdSet = new Set(nodes.map((n) => n.id))
  const addedExternalNodes = new Map<string, FunctionNode>()

  for (const call of parsed.callExpressions) {
    const sourceId = `${filePath}::${call.callerFunction}`
    const calleeName = call.calleeName

    // Skip built-in / common utility calls
    if (isBuiltinCall(calleeName)) continue

    // Try to resolve the callee
    const resolution = resolveCallee(calleeName, filePath, parsed, parsedFiles, importMap)

    if (resolution) {
      const targetId = `${resolution.filePath}::${resolution.functionName}`

      // If target is in another file, add it as an external node
      if (!nodeIdSet.has(targetId) && !addedExternalNodes.has(targetId)) {
        const targetParsed = parsedFiles.get(resolution.filePath)
        const targetFn = targetParsed?.functions.find((f) => f.name === resolution.functionName)

        addedExternalNodes.set(targetId, {
          id: targetId,
          name: resolution.functionName,
          filePath: resolution.filePath,
          lineNumber: targetFn?.line ?? 0,
          params: targetFn?.params ?? [],
          body: targetFn?.body ?? '',
          layer: classifyFunctionLayer(resolution.functionName, resolution.filePath),
          complexity: targetFn ? estimateFunctionComplexity(targetFn.body) : 1,
          isExported: targetFn?.isExported ?? true,
        })
      }

      if (nodeIdSet.has(sourceId) || sourceId.endsWith('::<module>')) {
        edges.push({
          id: generateId(),
          source: sourceId,
          target: targetId,
          label: calleeName,
          type: 'call',
        })
      }
    } else {
      // Unresolved call - try local function match
      const localTarget = `${filePath}::${calleeName.split('.').pop()!}`
      if (nodeIdSet.has(localTarget)) {
        edges.push({
          id: generateId(),
          source: sourceId,
          target: localTarget,
          label: calleeName,
          type: 'call',
        })
      }
    }
  }

  // Merge external nodes
  const allNodes = [...nodes, ...addedExternalNodes.values()]

  // Flag dead code: functions with no incoming calls (except exports and module-level)
  flagDeadCode(allNodes, edges)

  return { nodes: allNodes, edges }
}

interface ImportResolution {
  localName: string
  sourceFile: string
  originalName: string
}

function buildImportMap(
  parsed: ParsedFile,
  parsedFiles: Map<string, ParsedFile>
): ImportResolution[] {
  const resolutions: ImportResolution[] = []
  const knownFiles = new Set(parsedFiles.keys())

  for (const imp of parsed.imports) {
    // Skip external packages
    if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) continue

    // We don't have the current file path here, so we store the raw source
    // Resolution will happen at call time with the full context
    for (const spec of imp.specifiers) {
      resolutions.push({
        localName: spec === 'default' ? imp.source.split('/').pop()! : spec,
        sourceFile: imp.source,
        originalName: spec,
      })
    }
  }

  return resolutions
}

interface CalleeResolution {
  filePath: string
  functionName: string
}

function resolveCallee(
  calleeName: string,
  currentFile: string,
  currentParsed: ParsedFile,
  parsedFiles: Map<string, ParsedFile>,
  importMap: ImportResolution[]
): CalleeResolution | null {
  // Simple name (no dots)
  const simpleName = calleeName.includes('.') ? calleeName.split('.')[0] : calleeName

  // Check local functions first
  const localFn = currentParsed.functions.find((f) => f.name === calleeName)
  if (localFn) {
    return { filePath: currentFile, functionName: calleeName }
  }

  // Check imports
  const importResolution = importMap.find((r) => r.localName === simpleName)
  if (importResolution) {
    // Resolve the import source to an actual file
    const resolvedFile = resolveImportToFile(
      currentFile,
      importResolution.sourceFile,
      parsedFiles
    )
    if (resolvedFile) {
      const targetName = calleeName.includes('.')
        ? calleeName.split('.').slice(1).join('.')
        : importResolution.originalName === 'default'
          ? calleeName
          : importResolution.originalName
      return { filePath: resolvedFile, functionName: targetName }
    }
  }

  return null
}

function resolveImportToFile(
  fromFile: string,
  importSource: string,
  parsedFiles: Map<string, ParsedFile>
): string | null {
  if (!importSource.startsWith('.')) return null

  const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'))
  const resolved = normalizePath(fromDir + '/' + importSource)

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']
  for (const ext of extensions) {
    const candidate = resolved + ext
    if (parsedFiles.has(candidate)) {
      return candidate
    }
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
    'console.debug', 'console.trace',
    'JSON.parse', 'JSON.stringify',
    'Object.keys', 'Object.values', 'Object.entries', 'Object.assign',
    'Object.freeze', 'Object.create',
    'Array.isArray', 'Array.from',
    'String', 'Number', 'Boolean', 'BigInt', 'Symbol',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'Promise.all', 'Promise.allSettled', 'Promise.race', 'Promise.resolve', 'Promise.reject',
    'Math.max', 'Math.min', 'Math.floor', 'Math.ceil', 'Math.round', 'Math.random',
    'Date.now', 'Date.parse',
    'require', 'import',
    'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
    'Map', 'Set', 'WeakMap', 'WeakSet',
    'Error', 'TypeError', 'RangeError', 'SyntaxError',
    'RegExp',
  ])
  return builtins.has(name)
}

/**
 * Flag functions with no incoming call edges as dead code,
 * unless they are exported (which means they could be called externally).
 */
function flagDeadCode(nodes: FunctionNode[], edges: GraphEdge[]): void {
  const calledIds = new Set(edges.map((e) => e.target))

  for (const node of nodes) {
    if (!node.isExported && !calledIds.has(node.id)) {
      node.isDeadCode = true
    }
  }
}
