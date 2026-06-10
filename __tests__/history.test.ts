import { describe, it, expect } from 'vitest';
import { sampleCommits } from '../lib/history/commits';
import { computeChurn, diffGraphs } from '../lib/history/churn';
import type { CommitMeta } from '../lib/history/types';
import type { GraphData, GraphNode } from '../lib/graph/types';

/* ── Fixtures ─────────────────────────────────────────────── */

/** Build N commits in GitHub order (newest first): c{N-1} … c0. */
function makeCommits(n: number): CommitMeta[] {
  const out: CommitMeta[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push({
      sha: `sha${i}`,
      message: `commit ${i}`,
      author: 'tester',
      date: new Date(2020, 0, i + 1).toISOString(),
    });
  }
  return out;
}

function node(id: string): GraphNode {
  return {
    id,
    filePath: id,
    label: id,
    fileType: 'utility',
    loc: 10,
    complexity: 1,
    imports: [],
    exports: [],
    functions: [],
  };
}

function graph(ids: string[]): GraphData {
  return { nodes: ids.map(node), edges: [], clusters: [] };
}

/* ── sampleCommits ───────────────────────────────────────── */

describe('sampleCommits', () => {
  it('returns chronological order (oldest → newest)', () => {
    // Input is newest-first: sha9..sha0. Sampling all should reverse it.
    const commits = makeCommits(10);
    const sampled = sampleCommits(commits, 10);
    expect(sampled.map((c) => c.sha)).toEqual([
      'sha0', 'sha1', 'sha2', 'sha3', 'sha4',
      'sha5', 'sha6', 'sha7', 'sha8', 'sha9',
    ]);
  });

  it('always includes oldest and newest endpoints', () => {
    const commits = makeCommits(100);
    const sampled = sampleCommits(commits, 5);
    expect(sampled[0].sha).toBe('sha0');
    expect(sampled[sampled.length - 1].sha).toBe('sha99');
  });

  it('picks evenly-spaced commits deterministically', () => {
    const commits = makeCommits(11); // indices 0..10 chronological
    const sampled = sampleCommits(commits, 3);
    // Endpoints + midpoint: 0, 5, 10
    expect(sampled.map((c) => c.sha)).toEqual(['sha0', 'sha5', 'sha10']);
  });

  it('is deterministic across calls', () => {
    const commits = makeCommits(50);
    const a = sampleCommits(commits, 7).map((c) => c.sha);
    const b = sampleCommits(commits, 7).map((c) => c.sha);
    expect(a).toEqual(b);
  });

  it('returns all commits when count exceeds history length', () => {
    const commits = makeCommits(3);
    const sampled = sampleCommits(commits, 10);
    expect(sampled.map((c) => c.sha)).toEqual(['sha0', 'sha1', 'sha2']);
  });

  it('de-duplicates when count is near history length', () => {
    const commits = makeCommits(4); // 0,1,2,3
    const sampled = sampleCommits(commits, 3);
    const shas = sampled.map((c) => c.sha);
    expect(new Set(shas).size).toBe(shas.length); // no dupes
    expect(shas[0]).toBe('sha0');
    expect(shas[shas.length - 1]).toBe('sha3');
  });

  it('handles count of 1 (newest only) and edge inputs', () => {
    expect(sampleCommits(makeCommits(5), 1).map((c) => c.sha)).toEqual(['sha4']);
    expect(sampleCommits([], 5)).toEqual([]);
    expect(sampleCommits(makeCommits(5), 0)).toEqual([]);
  });
});

/* ── computeChurn ────────────────────────────────────────── */

describe('computeChurn', () => {
  it('counts content changes across snapshots', () => {
    const snapshots = [
      new Map([['a.ts', 'v1'], ['b.ts', 'x']]),
      new Map([['a.ts', 'v2'], ['b.ts', 'x']]), // a changed
      new Map([['a.ts', 'v3'], ['b.ts', 'x']]), // a changed again
    ];
    const churn = computeChurn(snapshots);
    expect(churn.get('a.ts')!.changes).toBe(2);
    expect(churn.get('b.ts')!.changes).toBe(0);
  });

  it('counts additions and removals as changes', () => {
    const snapshots = [
      new Map([['a.ts', 'v1']]),
      new Map([['a.ts', 'v1'], ['b.ts', 'new']]), // b added
      new Map([['b.ts', 'new']]),                 // a removed
    ];
    const churn = computeChurn(snapshots);
    expect(churn.get('b.ts')!.changes).toBe(1); // absent → present
    expect(churn.get('a.ts')!.changes).toBe(1); // present → absent
  });

  it('normalises heat to [0,1] against the hottest file', () => {
    const snapshots = [
      new Map([['hot.ts', '0'], ['cold.ts', 'k']]),
      new Map([['hot.ts', '1'], ['cold.ts', 'k']]),
      new Map([['hot.ts', '2'], ['cold.ts', 'k']]),
    ];
    const churn = computeChurn(snapshots);
    expect(churn.get('hot.ts')!.heat).toBe(1);
    expect(churn.get('cold.ts')!.heat).toBe(0);
  });

  it('returns zero heat when nothing changed', () => {
    const snapshots = [
      new Map([['a.ts', 'same']]),
      new Map([['a.ts', 'same']]),
    ];
    const churn = computeChurn(snapshots);
    expect(churn.get('a.ts')!.changes).toBe(0);
    expect(churn.get('a.ts')!.heat).toBe(0);
  });

  it('handles a single snapshot (no transitions)', () => {
    const churn = computeChurn([new Map([['a.ts', 'v1']])]);
    expect(churn.get('a.ts')!.changes).toBe(0);
    expect(churn.get('a.ts')!.heat).toBe(0);
  });

  it('handles empty input', () => {
    expect(computeChurn([]).size).toBe(0);
  });
});

/* ── diffGraphs ──────────────────────────────────────────── */

describe('diffGraphs', () => {
  it('classifies added / removed / persisting nodes', () => {
    const prev = graph(['a', 'b', 'c']);
    const next = graph(['b', 'c', 'd']);
    const diff = diffGraphs(prev, next);
    expect(diff.added.sort()).toEqual(['d']);
    expect(diff.removed.sort()).toEqual(['a']);
    expect(diff.persisting.sort()).toEqual(['b', 'c']);
  });

  it('reports all added when prev is empty', () => {
    const diff = diffGraphs(graph([]), graph(['a', 'b']));
    expect(diff.added.sort()).toEqual(['a', 'b']);
    expect(diff.removed).toEqual([]);
    expect(diff.persisting).toEqual([]);
  });

  it('reports all removed when next is empty', () => {
    const diff = diffGraphs(graph(['a', 'b']), graph([]));
    expect(diff.removed.sort()).toEqual(['a', 'b']);
    expect(diff.added).toEqual([]);
    expect(diff.persisting).toEqual([]);
  });

  it('reports all persisting for identical graphs', () => {
    const diff = diffGraphs(graph(['a', 'b']), graph(['a', 'b']));
    expect(diff.persisting.sort()).toEqual(['a', 'b']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });
});
