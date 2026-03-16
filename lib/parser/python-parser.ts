import type {
  CallDef,
  FunctionDef,
  ImportDef,
  ParsedFile,
} from '@/lib/parser/types';

/**
 * Regex-based Python parser.
 * Covers ~90% of common patterns for import/function/class extraction.
 */
export function parsePython(content: string, filePath: string): ParsedFile {
  const lines = content.split('\n');
  const loc = lines.length;
  const imports: ImportDef[] = [];
  const exports: string[] = [];
  const functions: FunctionDef[] = [];
  const calls: CallDef[] = [];

  // Track current function for call attribution
  let currentFunction = '<module>';

  // Regex patterns
  const importRe = /^import\s+([\w.]+)(?:\s+as\s+\w+)?/;
  const fromImportRe = /^from\s+([\w.]+)\s+import\s+(.+)/;
  const defRe = /^(\s*)def\s+(\w+)\s*\(([^)]*)\)\s*(?:->.*)?:/;
  const classRe = /^class\s+(\w+)(?:\([^)]*\))?\s*:/;
  const decoratorRouteRe =
    /^@(?:app|router)\.(route|get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/;

  let isNextFunctionRoute = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const lineNum = i + 1;

    // ── Imports ──────────────────────────────────────────
    const importMatch = trimmed.match(importRe);
    if (importMatch) {
      imports.push({ source: importMatch[1], specifiers: [importMatch[1]] });
      continue;
    }

    const fromImportMatch = trimmed.match(fromImportRe);
    if (fromImportMatch) {
      const source = fromImportMatch[1];
      const specPart = fromImportMatch[2];
      const specifiers = specPart
        .split(',')
        .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      imports.push({ source, specifiers });
      continue;
    }

    // ── Route decorators ─────────────────────────────────
    const routeMatch = trimmed.match(decoratorRouteRe);
    if (routeMatch) {
      isNextFunctionRoute = true;
      continue;
    }

    // ── Functions ────────────────────────────────────────
    const defMatch = line.match(defRe);
    if (defMatch) {
      const indent = defMatch[1];
      const name = defMatch[2];
      const paramsStr = defMatch[3];
      const params = paramsStr
        .split(',')
        .map((p) => p.trim().split(':')[0].split('=')[0].trim())
        .filter((p) => p && p !== 'self' && p !== 'cls');

      // Top-level functions (no indent) or methods in a class
      const isTopLevel = indent.length === 0;
      functions.push({
        name,
        line: lineNum,
        params,
        body: '',
        isExported: isTopLevel,
      });

      if (isNextFunctionRoute) {
        // Mark that this function is a route handler —
        // graph builder can detect from calls
        calls.push({
          caller: name,
          callee: `route:${name}`,
          line: lineNum,
        });
        isNextFunctionRoute = false;
      }

      currentFunction = name;
      continue;
    }

    // ── Classes ──────────────────────────────────────────
    const classMatch = trimmed.match(classRe);
    if (classMatch) {
      const name = classMatch[1];
      exports.push(name);
      functions.push({
        name,
        line: lineNum,
        params: [],
        body: '',
        isExported: true,
      });
      currentFunction = name;
      continue;
    }

    // ── Call expressions (simple heuristic) ──────────────
    // Match function calls like: foo(), bar.baz(), self.method()
    const callRe = /(?:^|\s|=|\(|,)(\w+(?:\.\w+)*)\s*\(/g;
    let callMatch;
    while ((callMatch = callRe.exec(trimmed)) !== null) {
      const callee = callMatch[1];
      // Skip keywords and common non-function tokens
      if (
        [
          'if',
          'for',
          'while',
          'print',
          'return',
          'class',
          'def',
          'with',
          'assert',
          'raise',
          'except',
          'elif',
          'import',
          'from',
        ].includes(callee)
      ) {
        continue;
      }
      calls.push({ caller: currentFunction, callee, line: lineNum });
    }
  }

  return { filePath, imports, exports, functions, calls, loc };
}
