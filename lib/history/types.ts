import type { GraphData } from '@/lib/graph/types';

/** A single commit in a repository's history (subset of the GitHub commit shape). */
export interface CommitMeta {
  /** Full commit SHA. */
  sha: string;
  /** First line of the commit message. */
  message: string;
  /** Author display name, when available. */
  author: string;
  /** ISO-8601 author date. */
  date: string;
}

/**
 * A parsed snapshot of the codebase at one sampled commit: the commit metadata
 * plus the dependency graph built from the files at that commit.
 */
export interface Snapshot {
  commit: CommitMeta;
  graph: GraphData;
}

/**
 * Per-file churn across a series of snapshots.
 *
 * `changes` counts how many snapshot-to-snapshot transitions changed the file's
 * content (added, removed, or modified). `heat` is that count normalised to
 * [0, 1] against the hottest file in the series, ready for rendering.
 */
export interface FileChurn {
  filePath: string;
  changes: number;
  heat: number;
}

/** Lifecycle of a node between two consecutive snapshots. */
export type NodeLifecycle = 'added' | 'removed' | 'persisting';

/**
 * The result of diffing two consecutive snapshots' graphs: which node ids
 * appeared, disappeared, or carried over. Drives fade-in / fade-out animation.
 */
export interface GraphDiff {
  added: string[];
  removed: string[];
  persisting: string[];
}
