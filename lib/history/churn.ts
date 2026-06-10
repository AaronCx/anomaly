import type { GraphData } from '@/lib/graph/types';
import type { FileChurn, GraphDiff } from '@/lib/history/types';

/**
 * Compute per-file churn across an ordered series of file maps (one per sampled
 * snapshot, chronological).
 *
 * A file "changes" in a transition when its content differs from the previous
 * snapshot — that includes being added (absent → present), removed (present →
 * absent), or modified (content differs). The count is the number of such
 * transitions; `heat` normalises it to [0, 1] against the busiest file so the
 * renderer can scale a glow. Files that never changed get heat 0.
 */
export function computeChurn(
  snapshots: ReadonlyArray<Map<string, string>>,
): Map<string, FileChurn> {
  const changes = new Map<string, number>();

  // Collect every path that ever appeared so removals are counted too.
  const allPaths = new Set<string>();
  for (const snap of snapshots) {
    for (const path of snap.keys()) allPaths.add(path);
  }
  for (const path of allPaths) changes.set(path, 0);

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    for (const path of allPaths) {
      const before = prev.get(path);
      const after = curr.get(path);
      if (before !== after) {
        changes.set(path, (changes.get(path) ?? 0) + 1);
      }
    }
  }

  let max = 0;
  for (const c of changes.values()) if (c > max) max = c;

  const result = new Map<string, FileChurn>();
  for (const [filePath, count] of changes) {
    result.set(filePath, {
      filePath,
      changes: count,
      heat: max > 0 ? count / max : 0,
    });
  }
  return result;
}

/**
 * Diff two consecutive snapshot graphs by node id, classifying each node as
 * added (only in `next`), removed (only in `prev`), or persisting (in both).
 * Drives fade-in / fade-out as the timeline advances.
 */
export function diffGraphs(prev: GraphData, next: GraphData): GraphDiff {
  const prevIds = new Set(prev.nodes.map((n) => n.id));
  const nextIds = new Set(next.nodes.map((n) => n.id));

  const added: string[] = [];
  const removed: string[] = [];
  const persisting: string[] = [];

  for (const id of nextIds) {
    if (prevIds.has(id)) persisting.push(id);
    else added.push(id);
  }
  for (const id of prevIds) {
    if (!nextIds.has(id)) removed.push(id);
  }

  return { added, removed, persisting };
}
