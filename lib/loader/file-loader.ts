const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.venv',
  'vendor',
]);

const SKIP_EXTENSIONS = new Set(['.lock', '.map']);

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.java',
]);

// The architecture-rules file is read by the graph builder even though it
// isn't source code.
const RULES_BASENAME = '.anomaly.yml';

function shouldInclude(path: string): boolean {
  const segments = path.split('/');
  for (const seg of segments) {
    if (SKIP_DIRS.has(seg)) return false;
  }
  if (segments[segments.length - 1] === RULES_BASENAME) return true;
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx === -1) return false;
  const ext = path.slice(dotIdx);
  if (SKIP_EXTENSIONS.has(ext)) return false;
  return SOURCE_EXTENSIONS.has(ext);
}

/**
 * Read files from a browser FileList (drag-and-drop or file picker).
 * Returns a Map of relative file paths to their text content.
 */
export async function loadFromFileList(
  files: FileList,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const readPromises: Promise<void>[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // webkitRelativePath is available when using directory picker or drag-and-drop
    const path = (file as File & { webkitRelativePath?: string })
      .webkitRelativePath || file.name;

    if (!shouldInclude(path)) continue;

    readPromises.push(
      file.text().then((content) => {
        result.set(path, content);
      }),
    );
  }

  await Promise.all(readPromises);
  return result;
}
