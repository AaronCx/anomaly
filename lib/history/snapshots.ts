import { loadFromGitHub } from '@/lib/loader/github-loader';
import { buildGraph } from '@/lib/graph/graph-builder';
import { listCommits, sampleCommits } from '@/lib/history/commits';
import { computeChurn } from '@/lib/history/churn';
import type { CommitMeta, FileChurn, Snapshot } from '@/lib/history/types';

/** Progress reported while building the timeline. */
export interface HistoryProgress {
  /** Snapshots whose graph has been built so far. */
  snapshotsLoaded: number;
  /** Total snapshots being loaded. */
  totalSnapshots: number;
  /** Most recent GitHub rate-limit-remaining value, if known. */
  rateLimitRemaining?: number;
}

export interface HistoryResult {
  snapshots: Snapshot[];
  /** Per-file churn across the sampled snapshots, keyed by file path. */
  churn: Map<string, FileChurn>;
}

export interface LoadHistoryOptions {
  owner: string;
  repo: string;
  token?: string;
  /** Number of commits to sample across history. */
  sampleCount: number;
  /** Upper bound on commits pulled before sampling. */
  maxCommits?: number;
  onProgress?: (p: HistoryProgress) => void;
  /** Abort cooperatively between snapshot loads. */
  signal?: AbortSignal;
}

/**
 * In-memory cache of parsed file maps keyed by `owner/repo@sha`. Lives for the
 * page session so re-scrubbing or changing the sample count never re-downloads
 * a commit already fetched.
 */
const fileMapCache = new Map<string, Map<string, string>>();

function cacheKey(owner: string, repo: string, sha: string): string {
  return `${owner}/${repo}@${sha}`;
}

/** sessionStorage key for a cached file map, when persistence is available. */
function sessionKey(owner: string, repo: string, sha: string): string {
  return `anomaly:snapshot:${cacheKey(owner, repo, sha)}`;
}

function readSessionCache(
  owner: string,
  repo: string,
  sha: string,
): Map<string, string> | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(sessionKey(owner, repo, sha));
    if (!raw) return undefined;
    const entries = JSON.parse(raw) as [string, string][];
    return new Map(entries);
  } catch {
    return undefined;
  }
}

function writeSessionCache(
  owner: string,
  repo: string,
  sha: string,
  files: Map<string, string>,
): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      sessionKey(owner, repo, sha),
      JSON.stringify(Array.from(files.entries())),
    );
  } catch {
    // Quota exceeded or unavailable: in-memory cache still applies.
  }
}

/**
 * Load the file map for a single commit, consulting the in-memory cache first,
 * then sessionStorage, then the network. Parsed maps are written back to both
 * caches keyed by SHA.
 */
async function loadFileMapAtCommit(
  opts: LoadHistoryOptions,
  sha: string,
  onRate?: (remaining: number) => void,
): Promise<Map<string, string>> {
  const { owner, repo, token } = opts;
  const key = cacheKey(owner, repo, sha);

  const mem = fileMapCache.get(key);
  if (mem) return mem;

  const session = readSessionCache(owner, repo, sha);
  if (session) {
    fileMapCache.set(key, session);
    return session;
  }

  const files = await loadFromGitHub(
    owner,
    repo,
    token,
    (_loaded, _total, remaining) => {
      if (typeof remaining === 'number' && remaining >= 0) onRate?.(remaining);
    },
    sha,
  );

  fileMapCache.set(key, files);
  writeSessionCache(owner, repo, sha, files);
  return files;
}

/**
 * Build the full timeline for a repo: list commits, sample `sampleCount` of them
 * evenly across history (oldest → newest), load each sampled commit's file map
 * (cached by SHA), build a graph per snapshot, and compute per-file churn.
 *
 * Stays within GitHub rate limits by capping commits pulled (`maxCommits`),
 * sampling conservatively, loading snapshots sequentially (not all at once),
 * and reusing cached blobs/maps so re-scrubs cost nothing.
 */
export async function loadHistory(
  opts: LoadHistoryOptions,
): Promise<HistoryResult> {
  const { owner, repo, token, sampleCount, maxCommits = 300, onProgress, signal } = opts;

  const all = await listCommits(owner, repo, token, maxCommits);
  const sampled: CommitMeta[] = sampleCommits(all, sampleCount);

  const snapshots: Snapshot[] = [];
  const fileMaps: Map<string, string>[] = [];
  let rateLimitRemaining: number | undefined;

  for (let i = 0; i < sampled.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const commit = sampled[i];
    const files = await loadFileMapAtCommit(opts, commit.sha, (remaining) => {
      rateLimitRemaining = remaining;
    });

    fileMaps.push(files);
    snapshots.push({ commit, graph: buildGraph(files) });

    onProgress?.({
      snapshotsLoaded: i + 1,
      totalSnapshots: sampled.length,
      rateLimitRemaining,
    });
  }

  const churn = computeChurn(fileMaps);
  return { snapshots, churn };
}

/** Clear the in-memory snapshot cache (used by tests). */
export function clearSnapshotCache(): void {
  fileMapCache.clear();
}
