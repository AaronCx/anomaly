import type { FileType, GraphData, GraphEdge, GraphNode } from '@/lib/graph/types';
import { parseFile } from '@/lib/parser/index';
import type { ParsedFile } from '@/lib/parser/types';
import { detectClusters } from '@/lib/graph/cluster-detection';

/**
 * Classify a file into a FileType based on path heuristics.
 */
function classifyFileType(filePath: string, parsed: ParsedFile): FileType {
  const lower = filePath.toLowerCase();
  const segments = lower.split('/');
  const fileName = segments[segments.length - 1];

  // Test files
  if (
    fileName.includes('.test.') ||
    fileName.includes('.spec.') ||
    segments.includes('__tests__') ||
    segments.includes('tests') ||
    segments.includes('test')
  ) {
    return 'test';
  }

  // Config files
  if (
    fileName.includes('.config.') ||
    fileName.startsWith('.') ||
    fileName === 'tsconfig.json' ||
    fileName === 'package.json' ||
    segments.includes('config')
  ) {
    return 'config';
  }

  // Route files (Next.js app router, Express-style, etc.)
  if (
    fileName === 'route.ts' ||
    fileName === 'route.js' ||
    fileName === 'page.tsx' ||
    fileName === 'page.jsx' ||
    segments.includes('routes') ||
    segments.includes('api')
  ) {
    return 'route';
  }

  // Check parsed data for route patterns
  const hasRouteCall = parsed.calls.some(
    (c) =>
      c.callee.startsWith('app.') ||
      c.callee.startsWith('router.') ||
      c.callee.startsWith('route:'),
  );
  if (hasRouteCall) return 'route';

  // Components
  if (
    segments.includes('components') ||
    segments.includes('component') ||
    fileName.endsWith('.tsx') ||
    fileName.endsWith('.jsx')
  ) {
    // Check if it's actually a component (has default export, JSX extension)
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
      return 'component';
    }
  }

  // Services
  if (
    segments.includes('services') ||
    segments.includes('service') ||
    fileName.includes('service') ||
    fileName.includes('client') ||
    fileName.includes('api')
  ) {
    return 'service';
  }

  // Models / types
  if (
    segments.includes('models') ||
    segments.includes('model') ||
    segments.includes('types') ||
    fileName.includes('types') ||
    fileName.includes('model') ||
    fileName.includes('schema')
  ) {
    return 'model';
  }

  // Utility files
  if (
    segments.includes('utils') ||
    segments.includes('util') ||
    segments.includes('helpers') ||
    segments.includes('lib') ||
    fileName.includes('util') ||
    fileName.includes('helper')
  ) {
    return 'utility';
  }

  return 'unknown';
}

/**
 * Calculate a simple complexity score for a parsed file.
 * Uses LOC * function count as a proxy, plus counting control flow keywords.
 */
function calculateComplexity(content: string, parsed: ParsedFile): number {
  // Count control flow constructs as a rough complexity measure
  const controlFlowRe = /\b(if|else|for|while|switch|case|&&|\|\|)\b/g;
  const matches = content.match(controlFlowRe);
  const controlFlowCount = matches ? matches.length : 0;

  // Combine: function count + control flow density
  const fnCount = Math.max(parsed.functions.length, 1);
  return fnCount + controlFlowCount;
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java'];

/**
 * Try to find a file in the map with various extension/index combinations.
 */
function tryResolve(path: string, fileMap: Map<string, string>): string | null {
  if (fileMap.has(path)) return path;
  for (const ext of EXTENSIONS) {
    if (fileMap.has(path + ext)) return path + ext;
  }
  for (const ext of EXTENSIONS) {
    const indexPath = path + '/index' + ext;
    if (fileMap.has(indexPath)) return indexPath;
  }
  return null;
}

/**
 * Detect app roots in a monorepo by finding directories that contain
 * tsconfig.json or package.json (e.g., frontend/, apps/web/, packages/engine/).
 */
function detectAppRoots(fileMap: Map<string, string>): string[] {
  const roots = new Set<string>();
  roots.add(''); // Always try project root

  for (const filePath of fileMap.keys()) {
    const name = filePath.split('/').pop() || '';
    if (name === 'tsconfig.json' || name === 'package.json') {
      const dir = filePath.includes('/')
        ? filePath.slice(0, filePath.lastIndexOf('/'))
        : '';
      if (dir) roots.add(dir);
    }
  }

  return Array.from(roots);
}

/**
 * Resolve an import source to a file path in the project map.
 * Handles relative imports, @/ alias with monorepo-aware root detection,
 * and also tries resolving from the importing file's ancestor directories.
 */
function resolveImport(
  source: string,
  fromFile: string,
  fileMap: Map<string, string>,
  appRoots: string[],
): string | null {
  // Skip external packages (but keep @/ alias)
  if (source.startsWith('@/')) {
    // @/ alias — try each app root
    const aliasPath = source.slice(2);

    // First try: resolve relative to the importing file's nearest app root
    // e.g., if fromFile is "frontend/app/page.tsx", try "frontend/" + aliasPath
    const fromParts = fromFile.split('/');
    for (let i = fromParts.length - 1; i >= 1; i--) {
      const prefix = fromParts.slice(0, i).join('/');
      const candidate = prefix + '/' + aliasPath;
      const result = tryResolve(candidate, fileMap);
      if (result) return result;
    }

    // Then try each detected app root
    for (const root of appRoots) {
      const candidate = root ? root + '/' + aliasPath : aliasPath;
      const result = tryResolve(candidate, fileMap);
      if (result) return result;
    }

    // Finally try bare path (project root)
    return tryResolve(aliasPath, fileMap);
  }

  // Skip other scoped packages (@org/package)
  if (source.startsWith('@')) return null;

  // Skip bare package names (no ./ or ../ prefix)
  if (!source.startsWith('.') && !source.startsWith('/')) return null;

  // Relative import — resolve from importing file's directory
  const fromDir = fromFile.includes('/')
    ? fromFile.slice(0, fromFile.lastIndexOf('/'))
    : '';
  const parts = fromDir.split('/').filter(Boolean);
  const sourceParts = source.split('/');

  for (const part of sourceParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return tryResolve(parts.join('/'), fileMap);
}

/**
 * Build a complete graph from a set of source files.
 */
export function buildGraph(files: Map<string, string>): GraphData {
  const nodes: GraphNode[] = [];
  const edgeMap = new Map<string, number>(); // "source->target" → weight
  const appRoots = detectAppRoots(files);

  // Parse all files and create nodes
  const parsedFiles = new Map<string, ParsedFile>();
  for (const [filePath, content] of files) {
    const parsed = parseFile(content, filePath);
    parsedFiles.set(filePath, parsed);

    const fileType = classifyFileType(filePath, parsed);
    const complexity = calculateComplexity(content, parsed);
    const label = filePath.includes('/')
      ? filePath.slice(filePath.lastIndexOf('/') + 1)
      : filePath;

    nodes.push({
      id: filePath,
      filePath,
      label,
      fileType,
      loc: parsed.loc,
      complexity,
      imports: parsed.imports.map((i) => i.source),
      exports: parsed.exports,
      functions: parsed.functions,
    });
  }

  // Build edges from imports
  for (const [filePath, parsed] of parsedFiles) {
    for (const imp of parsed.imports) {
      const target = resolveImport(imp.source, filePath, files, appRoots);
      if (target && target !== filePath) {
        const edgeKey = `${filePath}->${target}`;
        edgeMap.set(edgeKey, (edgeMap.get(edgeKey) ?? 0) + imp.specifiers.length);
      }
    }
  }

  // Build function call edges (cross-file calls)
  const callEdgeMap = new Map<string, number>();
  for (const [filePath, parsed] of parsedFiles) {
    for (const call of parsed.calls) {
      // Check if callee matches an exported function in another file
      for (const [otherPath, otherParsed] of parsedFiles) {
        if (otherPath === filePath) continue;
        const isExported = otherParsed.exports.includes(call.callee) ||
          otherParsed.functions.some((f) => f.name === call.callee && f.isExported);
        if (isExported) {
          const callKey = `${filePath}=>${otherPath}`;
          callEdgeMap.set(callKey, (callEdgeMap.get(callKey) ?? 0) + 1);
        }
      }
    }
  }

  // Build export edges (reverse of imports — if B imports from A, A exports to B)
  const exportEdgeMap = new Map<string, number>();
  for (const [key, weight] of edgeMap) {
    const [source, target] = key.split('->');
    // Reverse: target exports to source
    const exportKey = `${target}->${source}`;
    // Only add if the target actually has exports
    const targetParsed = parsedFiles.get(target);
    if (targetParsed && targetParsed.exports.length > 0) {
      exportEdgeMap.set(exportKey, (exportEdgeMap.get(exportKey) ?? 0) + weight);
    }
  }

  const edges: GraphEdge[] = [];
  for (const [key, weight] of edgeMap) {
    const [source, target] = key.split('->');
    edges.push({ source, target, weight, type: 'import' });
  }
  for (const [key, weight] of exportEdgeMap) {
    const [source, target] = key.split('->');
    // Only add if not already covered by an import edge in the same direction
    if (!edgeMap.has(`${source}->${target}`)) {
      edges.push({ source, target, weight, type: 'export' });
    }
  }
  for (const [key, weight] of callEdgeMap) {
    const [source, target] = key.split('=>');
    const hasImportEdge = edgeMap.has(`${source}->${target}`);
    const hasExportEdge = exportEdgeMap.has(`${source}->${target}`);
    if (!hasImportEdge && !hasExportEdge) {
      edges.push({ source, target, weight, type: 'call' });
    }
  }

  // Detect clusters
  const clusters = detectClusters(nodes);

  return { nodes, edges, clusters };
}
