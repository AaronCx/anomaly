/**
 * Trace replay engine.
 *
 * Given a parsed AgentTrace and the dependency graph it ran against, produce a
 * deterministic per-step view state: which node is active this step, the read /
 * modified node sets accumulated so far, and the traversal path (edges between
 * consecutively-touched files) to highlight.
 *
 * Pure and deterministic — the same trace + graph always yields the same states,
 * so the UI scrubber can jump to any step without replaying from the start.
 */

import type { GraphData } from '@/lib/graph/types';
import type { AgentTrace, TraceStep } from './types';

/** Buckets a node falls into at a given replay step. */
export interface ReplayNodeSets {
  /** Node id active (touched) on the current step, if it resolved. */
  active: string | null;
  /** Node ids read at or before the current step. */
  read: Set<string>;
  /** Node ids modified/created at or before the current step. */
  modified: Set<string>;
  /** Node ids deleted at or before the current step. */
  deleted: Set<string>;
}

/** A highlighted hop between two consecutively-touched files. */
export interface TraversalEdge {
  source: string;
  target: string;
}

/** The full view state for one replay step. */
export interface ReplayState extends ReplayNodeSets {
  /** Zero-based index of the step this state describes. */
  step: number;
  /** The trace step itself (for labels / diff range). */
  raw: TraceStep;
  /** The step's file, unresolved (the raw path from the trace). */
  file: string;
  /**
   * Traversal path: edges connecting each consecutively-touched, resolved node
   * up to and including this step. Order follows the trace.
   */
  path: TraversalEdge[];
}

/* ── path → node matching ─────────────────────────────────── */

/** Normalise a path for comparison: forward slashes, no leading "./" or "/". */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.?\//, '').trim();
}

function basename(p: string): string {
  const n = normalizePath(p);
  const idx = n.lastIndexOf('/');
  return idx === -1 ? n : n.slice(idx + 1);
}

/**
 * Index a graph's nodes for fast path matching. Builds an exact map keyed by
 * normalised path and a basename map for fallback. Basenames that collide across
 * multiple nodes are dropped from the fallback map (ambiguous — we won't guess).
 */
export class NodeIndex {
  private byPath = new Map<string, string>();
  private byBasename = new Map<string, string | null>();

  constructor(graph: GraphData) {
    for (const node of graph.nodes) {
      const norm = normalizePath(node.filePath || node.id);
      this.byPath.set(norm, node.id);
      const base = basename(norm);
      if (this.byBasename.has(base)) {
        // Collision: mark ambiguous so we never resolve it by basename.
        this.byBasename.set(base, null);
      } else {
        this.byBasename.set(base, node.id);
      }
    }
  }

  /**
   * Resolve a trace file to a node id. Tries exact normalised path, then a
   * suffix match (trace path is often deeper/shallower than the node path), then
   * an unambiguous basename fallback. Returns null when nothing matches.
   */
  resolve(file: string): string | null {
    const norm = normalizePath(file);
    if (!norm) return null;

    const exact = this.byPath.get(norm);
    if (exact) return exact;

    // Suffix match: the trace path ends with a known node path, or vice versa.
    for (const [path, id] of this.byPath) {
      if (path.endsWith('/' + norm) || norm.endsWith('/' + path)) return id;
    }

    const base = basename(norm);
    const byBase = this.byBasename.get(base);
    return byBase ?? null;
  }
}

/* ── replay ───────────────────────────────────────────────── */

/**
 * Compute the full sequence of per-step replay states for a trace against a
 * graph. `states[i]` is the accumulated view state after applying step i.
 */
export function buildReplay(trace: AgentTrace, graph: GraphData): ReplayState[] {
  const index = new NodeIndex(graph);

  const read = new Set<string>();
  const modified = new Set<string>();
  const deleted = new Set<string>();
  const path: TraversalEdge[] = [];

  const states: ReplayState[] = [];
  let prevResolved: string | null = null;

  trace.steps.forEach((raw, i) => {
    const resolved = index.resolve(raw.file);

    if (resolved) {
      switch (raw.action) {
        case 'read':
          read.add(resolved);
          break;
        case 'modified':
        case 'created':
          modified.add(resolved);
          break;
        case 'deleted':
          deleted.add(resolved);
          break;
      }

      // Add a traversal hop from the previously-resolved node to this one.
      if (prevResolved && prevResolved !== resolved) {
        path.push({ source: prevResolved, target: resolved });
      }
      prevResolved = resolved;
    }

    states.push({
      step: i,
      raw,
      file: raw.file,
      active: resolved,
      read: new Set(read),
      modified: new Set(modified),
      deleted: new Set(deleted),
      path: path.slice(),
    });
  });

  return states;
}

/** How many of a trace's steps resolved to a node in the given graph. */
export function countResolved(trace: AgentTrace, graph: GraphData): number {
  const index = new NodeIndex(graph);
  let n = 0;
  for (const step of trace.steps) {
    if (index.resolve(step.file)) n++;
  }
  return n;
}
