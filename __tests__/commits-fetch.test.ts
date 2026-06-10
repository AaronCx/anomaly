import { describe, it, expect, vi, afterEach } from 'vitest';
import { listCommits } from '../lib/history/commits';

/* Stub the GitHub commits API — no network. */

function commitPage(shas: string[]) {
  return shas.map((sha) => ({
    sha,
    commit: { message: `msg ${sha}\n\nbody`, author: { name: 'Tester', date: '2020-01-01T00:00:00Z' } },
    author: { login: 'tester' },
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('listCommits', () => {
  it('maps GitHub commit shape to CommitMeta (first message line)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => commitPage(['a', 'b']),
    });
    vi.stubGlobal('fetch', fetchMock);

    const commits = await listCommits('o', 'r', undefined, 100);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({ sha: 'a', message: 'msg a', author: 'Tester' });
  });

  it('stops paginating when a short page is returned', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => commitPage(['a', 'b', 'c']),
    });
    vi.stubGlobal('fetch', fetchMock);

    await listCommits('o', 'r', undefined, 300);
    // 3 < per_page(100), so it should request exactly one page.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('respects the maxCommits cap', async () => {
    const fullPage = commitPage(Array.from({ length: 100 }, (_, i) => `s${i}`));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fullPage,
    });
    vi.stubGlobal('fetch', fetchMock);

    const commits = await listCommits('o', 'r', undefined, 50);
    expect(commits).toHaveLength(50);
  });

  it('throws a friendly message on rate limit (403)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listCommits('o', 'r')).rejects.toThrow(/rate limit/i);
  });
});
