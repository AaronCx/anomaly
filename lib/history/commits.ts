import { gitHubHeaders } from '@/lib/loader/github-loader';
import type { CommitMeta } from '@/lib/history/types';

/** Raw shape returned by `GET /repos/{o}/{r}/commits`. */
interface GitHubCommitItem {
  sha: string;
  commit: {
    message: string;
    author: { name?: string; date?: string } | null;
  };
  author: { login?: string } | null;
}

function toCommitMeta(item: GitHubCommitItem): CommitMeta {
  const firstLine = (item.commit.message ?? '').split('\n')[0].trim();
  return {
    sha: item.sha,
    message: firstLine,
    author: item.commit.author?.name ?? item.author?.login ?? 'unknown',
    date: item.commit.author?.date ?? '',
  };
}

/**
 * List commits for a repository, newest first, via the GitHub commits API.
 *
 * Paginates with `per_page=100` up to `maxCommits` so we never pull unbounded
 * history (which would burn rate limit on large repos). The returned list is in
 * GitHub order (newest → oldest).
 */
export async function listCommits(
  owner: string,
  repo: string,
  token?: string,
  maxCommits = 300,
): Promise<CommitMeta[]> {
  const headers = gitHubHeaders(token);
  const perPage = 100;
  const commits: CommitMeta[] = [];

  for (let page = 1; commits.length < maxCommits; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`,
      { headers },
    );

    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        throw new Error(
          'GitHub API rate limit exceeded. Provide a personal access token to increase limits.',
        );
      }
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const items: GitHubCommitItem[] = await res.json();
    if (items.length === 0) break;

    for (const item of items) {
      commits.push(toCommitMeta(item));
    }

    // Last page reached when GitHub returns fewer than a full page.
    if (items.length < perPage) break;
  }

  return commits.slice(0, maxCommits);
}

/**
 * Sample `count` commits evenly across a chronologically-ordered history so the
 * timeline stays tractable.
 *
 * The input is expected newest-first (GitHub order); the output is chronological
 * (oldest → newest) so scrubbing left-to-right moves forward in time. The first
 * (oldest) and last (newest) commits are always included, with the remainder
 * spaced as evenly as possible between them. Deterministic for a given input.
 */
export function sampleCommits(
  commits: CommitMeta[],
  count: number,
): CommitMeta[] {
  // Work in chronological order (oldest → newest).
  const chronological = [...commits].reverse();
  const n = chronological.length;

  if (n === 0) return [];
  if (count <= 0) return [];
  if (count >= n) return chronological;
  if (count === 1) return [chronological[n - 1]]; // newest only

  // Pick `count` indices evenly across [0, n-1], inclusive of both endpoints,
  // de-duplicating in case rounding collides on small histories.
  const picked = new Set<number>();
  const result: CommitMeta[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (n - 1)) / (count - 1));
    if (!picked.has(idx)) {
      picked.add(idx);
      result.push(chronological[idx]);
    }
  }
  return result;
}
