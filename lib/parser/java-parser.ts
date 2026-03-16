import type {
  CallDef,
  FunctionDef,
  ImportDef,
  ParsedFile,
} from '@/lib/parser/types';

/**
 * Regex-based Java parser.
 * Extracts imports, classes, methods, and Spring/JAX-RS route annotations.
 */
export function parseJava(content: string, filePath: string): ParsedFile {
  const lines = content.split('\n');
  const loc = lines.length;
  const imports: ImportDef[] = [];
  const exports: string[] = [];
  const functions: FunctionDef[] = [];
  const calls: CallDef[] = [];

  let currentFunction = '<module>';
  let isNextMethodRoute = false;

  // Regex patterns
  const importRe = /^import\s+(static\s+)?([\w.]+(?:\.\*)?)\s*;/;
  const packageRe = /^package\s+([\w.]+)\s*;/;
  const classRe =
    /^(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?(?:class|interface|enum)\s+(\w+)/;
  const methodRe =
    /^(\s*)(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:synchronized\s+)?(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*\(([^)]*)\)/;
  const routeAnnotationRe =
    /^\s*@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(?:\((.*)?\))?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const lineNum = i + 1;

    // ── Package ──────────────────────────────────────────
    const packageMatch = trimmed.match(packageRe);
    if (packageMatch) {
      // Package info can be used for module resolution
      exports.push(`package:${packageMatch[1]}`);
      continue;
    }

    // ── Imports ──────────────────────────────────────────
    const importMatch = trimmed.match(importRe);
    if (importMatch) {
      const source = importMatch[2];
      // Extract the class name (last segment)
      const parts = source.split('.');
      const specifier = parts[parts.length - 1];
      imports.push({ source, specifiers: [specifier] });
      continue;
    }

    // ── Route annotations ────────────────────────────────
    const routeMatch = trimmed.match(routeAnnotationRe);
    if (routeMatch) {
      isNextMethodRoute = true;
      continue;
    }

    // ── Classes ──────────────────────────────────────────
    const classMatch = trimmed.match(classRe);
    if (classMatch) {
      const name = classMatch[1];
      exports.push(name);
      continue;
    }

    // ── Methods ──────────────────────────────────────────
    const methodMatch = line.match(methodRe);
    if (methodMatch) {
      const name = methodMatch[3];
      const paramsStr = methodMatch[4];
      const params = paramsStr
        .split(',')
        .map((p) => {
          const parts = p.trim().split(/\s+/);
          // Last token is the param name; handle annotations
          return parts[parts.length - 1];
        })
        .filter((p) => p && p.length > 0);

      const isPublic = trimmed.startsWith('public');
      functions.push({
        name,
        line: lineNum,
        params,
        body: '',
        isExported: isPublic,
      });

      if (isNextMethodRoute) {
        calls.push({
          caller: name,
          callee: `route:${name}`,
          line: lineNum,
        });
        isNextMethodRoute = false;
      }

      currentFunction = name;
      continue;
    }

    // ── Call expressions (simple heuristic) ──────────────
    const callRe = /(\w+(?:\.\w+)*)\s*\(/g;
    let callMatch;
    while ((callMatch = callRe.exec(trimmed)) !== null) {
      const callee = callMatch[1];
      // Skip keywords and type constructors in declarations
      if (
        [
          'if',
          'for',
          'while',
          'switch',
          'catch',
          'return',
          'new',
          'throw',
          'class',
          'interface',
        ].includes(callee)
      ) {
        continue;
      }
      calls.push({ caller: currentFunction, callee, line: lineNum });
    }
  }

  return { filePath, imports, exports, functions, calls, loc };
}
