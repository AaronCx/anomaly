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

function shouldInclude(path: string): boolean {
  const segments = path.split('/');
  for (const seg of segments) {
    if (SKIP_DIRS.has(seg)) return false;
  }
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx === -1) return false;
  const ext = path.slice(dotIdx);
  if (SKIP_EXTENSIONS.has(ext)) return false;
  return SOURCE_EXTENSIONS.has(ext);
}

export type ProgressCallback = (
  filesLoaded: number,
  totalFiles: number,
  rateLimitRemaining?: number,
) => void;

interface GitHubTreeItem {
  path: string;
  type: string;
  sha: string;
  size?: number;
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubContentResponse {
  content: string;
  encoding: string;
}

/**
 * Load source files from a GitHub repository using the REST API.
 * Runs entirely in the browser — no backend needed.
 */
export async function loadFromGitHub(
  owner: string,
  repo: string,
  token?: string,
  onProgress?: ProgressCallback,
): Promise<Map<string, string>> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Fetch the full file tree
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers },
  );

  if (!treeRes.ok) {
    const msg = treeRes.status === 403
      ? 'GitHub API rate limit exceeded. Provide a personal access token to increase limits.'
      : `GitHub API error: ${treeRes.status} ${treeRes.statusText}`;
    throw new Error(msg);
  }

  const treeData: GitHubTreeResponse = await treeRes.json();

  // 2. Filter to source files only
  const sourceFiles = treeData.tree.filter(
    (item) => item.type === 'blob' && shouldInclude(item.path),
  );

  const total = sourceFiles.length;
  const result = new Map<string, string>();
  let loaded = 0;

  // 3. Batch-fetch file contents in groups of 10
  const BATCH_SIZE = 10;

  for (let i = 0; i < sourceFiles.length; i += BATCH_SIZE) {
    const batch = sourceFiles.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (file) => {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        { headers },
      );

      if (!res.ok) {
        // Skip files we can't fetch rather than failing the whole load
        return;
      }

      const rateLimitRemaining = parseInt(
        res.headers.get('x-ratelimit-remaining') ?? '-1',
        10,
      );

      const data: GitHubContentResponse = await res.json();

      if (data.encoding === 'base64' && data.content) {
        const content = atob(data.content.replace(/\n/g, ''));
        result.set(file.path, content);
      }

      loaded++;
      onProgress?.(loaded, total, rateLimitRemaining);
    });

    await Promise.all(promises);
  }

  return result;
}
