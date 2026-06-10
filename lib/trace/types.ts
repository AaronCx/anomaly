/**
 * Agent-trace overlay schema.
 *
 * A trace is an ordered record of what an AI agent did to a codebase during a
 * single run — which files it read, which it modified, in what order, and the
 * scope of each diff. Replaying a trace on the dependency graph lets you "watch
 * your AI agent move through your codebase".
 *
 * This is deliberately small. Adapters (lib/trace/parse.ts) convert richer real
 * sources — a Forge run event log, a Claude Code session transcript, a
 * LastGate-annotated PR — into this canonical shape.
 */

/** What the agent did to a file at one step. */
export type TraceAction = 'read' | 'modified' | 'created' | 'deleted';

/** The line range an edit touched, 1-based and inclusive. */
export interface DiffRange {
  start: number;
  end: number;
}

/** One step of an agent trace: a single action against a single file. */
export interface TraceStep {
  /** Repo-relative file path the action targeted. Maps to a graph node id. */
  file: string;
  /** What the agent did. */
  action: TraceAction;
  /** ISO-8601 timestamp of the action. */
  timestamp: string;
  /** Line range touched by a modification/creation, when known. */
  diffRange?: DiffRange;
  /** Human-readable label for the step (e.g. the tool call or commit subject). */
  label?: string;
}

/** A complete agent run trace: ordered steps plus optional provenance. */
export interface AgentTrace {
  /** Schema version; bumped if the step shape changes. */
  version: 1;
  /** Where this trace came from. */
  source: TraceSource;
  /** Optional run identifier (Forge run id, Claude session id, PR number…). */
  runId?: string;
  /** Optional display title for the run. */
  title?: string;
  /** Ordered steps. Order is the replay order; timestamps are advisory. */
  steps: TraceStep[];
}

/** Origin of a trace, recorded so the UI can label it. */
export type TraceSource =
  | 'generic'
  | 'forge'
  | 'claude-code'
  | 'lastgate';

/** The canonical set of trace actions, for validation. */
export const TRACE_ACTIONS: readonly TraceAction[] = [
  'read',
  'modified',
  'created',
  'deleted',
] as const;
