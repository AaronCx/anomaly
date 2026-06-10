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

interface GitHubBlobResponse {
  content: string;
  encoding: string;
}

/** Build the auth/accept headers shared by every GitHub REST call. */
export function gitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Turn a non-OK GitHub response into a user-facing error message. */
function gitHubErrorMessage(res: Response): string {
  if (res.status === 403 || res.status === 429) {
    return 'GitHub API rate limit exceeded. Provide a personal access token to increase limits.';
  }
  return `GitHub API error: ${res.status} ${res.statusText}`;
}

/**
 * Load source files from a GitHub repository using the REST API.
 * Runs entirely in the browser — no backend needed.
 *
 * Pass a `ref` (branch, tag, or commit SHA) to load the tree as it existed at
 * that point in history; defaults to HEAD. File contents are fetched by blob
 * SHA (from the recursive tree), which both pins them to the requested commit
 * and lets the blob endpoint be cached by content hash across snapshots.
 */
export async function loadFromGitHub(
  owner: string,
  repo: string,
  token?: string,
  onProgress?: ProgressCallback,
  ref = 'HEAD',
): Promise<Map<string, string>> {
  const headers = gitHubHeaders(token);

  // 1. Fetch the full file tree at the requested ref
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    { headers },
  );

  if (!treeRes.ok) {
    throw new Error(gitHubErrorMessage(treeRes));
  }

  const treeData: GitHubTreeResponse = await treeRes.json();

  // 2. Filter to source files only
  const sourceFiles = treeData.tree.filter(
    (item) => item.type === 'blob' && shouldInclude(item.path),
  );

  const total = sourceFiles.length;
  const result = new Map<string, string>();
  let loaded = 0;

  // 3. Batch-fetch file contents (by blob SHA) in groups of 10
  const BATCH_SIZE = 10;

  for (let i = 0; i < sourceFiles.length; i += BATCH_SIZE) {
    const batch = sourceFiles.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (file) => {
      // The blob endpoint is content-addressed by SHA, so the same blob across
      // snapshots resolves to the same URL and can be served from HTTP cache.
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs/${file.sha}`,
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

      const data: GitHubBlobResponse = await res.json();

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
