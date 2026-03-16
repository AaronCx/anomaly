import type { ParsedFile } from '@/lib/parser/types';
import { parseJavaScript } from '@/lib/parser/javascript-parser';
import { parsePython } from '@/lib/parser/python-parser';
import { parseJava } from '@/lib/parser/java-parser';

const JS_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

/**
 * Route a file to the appropriate parser based on its extension.
 */
export function parseFile(content: string, filePath: string): ParsedFile {
  const dotIdx = filePath.lastIndexOf('.');
  const ext = dotIdx !== -1 ? filePath.slice(dotIdx) : '';

  if (JS_EXTENSIONS.has(ext)) {
    return parseJavaScript(content, filePath);
  }

  if (ext === '.py') {
    return parsePython(content, filePath);
  }

  if (ext === '.java') {
    return parseJava(content, filePath);
  }

  // Unknown extension — return minimal ParsedFile with just LOC
  return {
    filePath,
    imports: [],
    exports: [],
    functions: [],
    calls: [],
    loc: content.split('\n').length,
  };
}
