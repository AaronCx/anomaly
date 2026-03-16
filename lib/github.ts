import { isSourceFile } from './utils'

const GITHUB_API = 'https://api.github.com'

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.venv',
  'vendor',
  '.turbo',
  'coverage',
  '.cache',
]

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'anomaly-codebase-xray',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

function isExcludedPath(path: string): boolean {
  const parts = path.split('/')
  return parts.some((part) => EXCLUDED_DIRS.includes(part))
}

interface GitHubTreeItem {
  path: string
  mode: string
  type: string
  sha: string
  size?: number
  url: string
}

interface GitHubTreeResponse {
  sha: string
  url: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

interface GitHubRepoResponse {
  default_branch: string
  language: string | null
  pushed_at: string
}

interface GitHubContentResponse {
  content: string
  encoding: string
  sha: string
}

export interface RepoInfo {
  defaultBranch: string
  language: string
  lastPush: string
}

export interface RepoFile {
  path: string
  sha: string
  size: number
}

async function githubFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: getHeaders() })

  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      const resetTime = res.headers.get('x-ratelimit-reset')
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null
      throw new Error(
        `GitHub API rate limit exceeded. Resets at ${resetDate?.toISOString() ?? 'unknown'}. ` +
          'Set GITHUB_TOKEN env var to increase limits.'
      )
    }
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export async function getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const data = await githubFetch<GitHubRepoResponse>(
    `${GITHUB_API}/repos/${owner}/${repo}`
  )
  return {
    defaultBranch: data.default_branch,
    language: data.language ?? 'unknown',
    lastPush: data.pushed_at,
  }
}

export async function fetchRepoTree(owner: string, repo: string): Promise<RepoFile[]> {
  const data = await githubFetch<GitHubTreeResponse>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
  )

  return data.tree
    .filter((item) => {
      if (item.type !== 'blob') return false
      if (isExcludedPath(item.path)) return false
      if (!isSourceFile(item.path)) return false
      return true
    })
    .map((item) => ({
      path: item.path,
      sha: item.sha,
      size: item.size ?? 0,
    }))
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const data = await githubFetch<GitHubContentResponse>(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`
  )

  if (data.encoding === 'base64') {
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }

  return data.content
}

export async function fetchFilesInBatches(
  owner: string,
  repo: string,
  files: RepoFile[],
  batchSize: number = 5,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, string>> {
  const contents = new Map<string, string>()
  const total = files.length

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const content = await fetchFileContent(owner, repo, file.path)
        return { path: file.path, content }
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        contents.set(result.value.path, result.value.content)
      }
      // Skip files that failed to fetch
    }

    onProgress?.(Math.min(i + batchSize, total), total)
  }

  return contents
}
