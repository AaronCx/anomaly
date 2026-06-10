/**
 * Trace ingestion: validate the canonical schema and adapt real sources into it.
 *
 * - `parseTrace` validates a canonical AgentTrace (the JSON the schema describes).
 * - `adaptForgeRunLog` / `adaptClaudeCodeSession` convert best-effort from the
 *   shapes those tools emit. They are deliberately tolerant: unknown fields are
 *   ignored, missing timestamps are synthesised, and unrecognised tool calls are
 *   skipped rather than throwing — a half-readable trace is still useful.
 * - `parseTraceInput` is the single entry point the UI uses: hand it parsed JSON
 *   of unknown shape and it picks the right adapter (or validates canonical).
 */

import type {
  AgentTrace,
  DiffRange,
  TraceAction,
  TraceSource,
  TraceStep,
} from './types';
import { TRACE_ACTIONS } from './types';

/** Thrown when input cannot be coerced into a valid AgentTrace. */
export class TraceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TraceParseError';
  }
}

/* ── small guards ─────────────────────────────────────────── */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isTraceAction(v: unknown): v is TraceAction {
  return typeof v === 'string' && (TRACE_ACTIONS as readonly string[]).includes(v);
}

function isIsoTimestamp(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && !Number.isNaN(Date.parse(v));
}

function coerceDiffRange(v: unknown): DiffRange | undefined {
  if (!isObject(v)) return undefined;
  const { start, end } = v;
  if (typeof start !== 'number' || typeof end !== 'number') return undefined;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  // Normalise so start <= end and both are >= 1.
  const lo = Math.max(1, Math.min(start, end));
  const hi = Math.max(1, Math.max(start, end));
  return { start: lo, end: hi };
}

/* ── canonical schema validation ──────────────────────────── */

/**
 * Validate a canonical AgentTrace. Throws TraceParseError with a precise message
 * on any structural problem. Returns a normalised copy (diff ranges ordered,
 * steps shallow-cloned) so the caller owns clean data.
 */
export function parseTrace(input: unknown): AgentTrace {
  if (!isObject(input)) {
    throw new TraceParseError('Trace must be a JSON object.');
  }
  if (input.version !== 1) {
    throw new TraceParseError('Unsupported or missing trace version (expected 1).');
  }
  const source = input.source;
  if (!isValidSource(source)) {
    throw new TraceParseError(
      `Invalid trace source "${String(source)}".`,
    );
  }
  if (!Array.isArray(input.steps)) {
    throw new TraceParseError('Trace.steps must be an array.');
  }
  if (input.steps.length === 0) {
    throw new TraceParseError('Trace must contain at least one step.');
  }

  const steps: TraceStep[] = input.steps.map((raw, i) => validateStep(raw, i));

  const trace: AgentTrace = {
    version: 1,
    source,
    steps,
  };
  if (typeof input.runId === 'string') trace.runId = input.runId;
  if (typeof input.title === 'string') trace.title = input.title;
  return trace;
}

function isValidSource(v: unknown): v is TraceSource {
  return v === 'generic' || v === 'forge' || v === 'claude-code' || v === 'lastgate';
}

function validateStep(raw: unknown, index: number): TraceStep {
  if (!isObject(raw)) {
    throw new TraceParseError(`Step ${index} must be an object.`);
  }
  if (typeof raw.file !== 'string' || raw.file.trim() === '') {
    throw new TraceParseError(`Step ${index} is missing a non-empty "file".`);
  }
  if (!isTraceAction(raw.action)) {
    throw new TraceParseError(
      `Step ${index} has invalid action "${String(raw.action)}".`,
    );
  }
  if (!isIsoTimestamp(raw.timestamp)) {
    throw new TraceParseError(
      `Step ${index} has invalid timestamp "${String(raw.timestamp)}".`,
    );
  }
  const step: TraceStep = {
    file: raw.file,
    action: raw.action,
    timestamp: raw.timestamp,
  };
  const range = coerceDiffRange(raw.diffRange);
  if (range) step.diffRange = range;
  if (typeof raw.label === 'string') step.label = raw.label;
  return step;
}

/* ── adapter helpers ──────────────────────────────────────── */

/** Synthesise a monotonic timestamp when a source omits one. */
function synthTimestamp(base: number, index: number): string {
  return new Date(base + index * 1000).toISOString();
}

/**
 * Map an arbitrary verb to a canonical action. Returns null for verbs that don't
 * correspond to a file touch (e.g. "bash", "think") so the caller can skip them.
 */
function verbToAction(verb: string): TraceAction | null {
  const v = verb.toLowerCase();
  if (v.includes('delete') || v.includes('rm') || v === 'remove') return 'deleted';
  if (v.includes('create') || v.includes('write') || v === 'add' || v === 'new') {
    return 'created';
  }
  if (
    v.includes('edit') ||
    v.includes('modif') ||
    v.includes('replace') ||
    v.includes('patch') ||
    v.includes('update') ||
    v === 'multiedit'
  ) {
    return 'modified';
  }
  if (v.includes('read') || v.includes('view') || v.includes('open') || v === 'cat') {
    return 'read';
  }
  return null;
}

/* ── Forge run-event-log adapter ──────────────────────────── */

/**
 * Best-effort shape of a Forge run event log. Forge emits a run as a list of
 * events; tool-call events carry the tool name and its arguments. We read
 * file-touching tool calls (read/write/edit) and ignore the rest.
 */
export interface ForgeRunLog {
  runId?: string;
  title?: string;
  events?: ForgeEvent[];
}

export interface ForgeEvent {
  type?: string;
  tool?: string;
  /** Tool arguments — paths live here under various keys across Forge versions. */
  args?: Record<string, unknown>;
  path?: string;
  file?: string;
  timestamp?: string;
  ts?: string;
  /** Some events carry a diff hunk with a line range. */
  range?: { start?: number; end?: number };
}

function pathFromForge(ev: ForgeEvent): string | undefined {
  const candidates = [
    ev.path,
    ev.file,
    ev.args?.path,
    ev.args?.file,
    ev.args?.file_path,
    ev.args?.filePath,
    ev.args?.target,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c;
  }
  return undefined;
}

/** Convert a Forge run log into a canonical AgentTrace. */
export function adaptForgeRunLog(input: unknown): AgentTrace {
  if (!isObject(input)) {
    throw new TraceParseError('Forge run log must be a JSON object.');
  }
  const events = Array.isArray(input.events) ? (input.events as ForgeEvent[]) : [];
  const base = Date.now();
  const steps: TraceStep[] = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!isObject(ev)) continue;
    // Only tool-call events touch files. Forge labels them "tool" / "tool_call".
    const isToolEvent =
      ev.type === undefined ||
      ev.type === 'tool' ||
      ev.type === 'tool_call' ||
      ev.type === 'tool_use';
    if (!isToolEvent) continue;

    const verb = typeof ev.tool === 'string' ? ev.tool : typeof ev.type === 'string' ? ev.type : '';
    const action = verbToAction(verb);
    if (!action) continue;

    const file = pathFromForge(ev);
    if (!file) continue;

    const timestamp = isIsoTimestamp(ev.timestamp)
      ? ev.timestamp
      : isIsoTimestamp(ev.ts)
        ? ev.ts
        : synthTimestamp(base, i);

    const step: TraceStep = { file, action, timestamp, label: verb || action };
    const range = coerceDiffRange(ev.range ?? ev.args?.range);
    if (range) step.diffRange = range;
    steps.push(step);
  }

  if (steps.length === 0) {
    throw new TraceParseError('Forge run log contained no file-touching tool calls.');
  }

  const trace: AgentTrace = { version: 1, source: 'forge', steps };
  if (typeof input.runId === 'string') trace.runId = input.runId;
  if (typeof input.title === 'string') trace.title = input.title;
  return trace;
}

/* ── Claude Code session adapter ──────────────────────────── */

/**
 * Best-effort shape of a Claude Code session transcript. A session is a list of
 * messages; assistant messages contain tool_use blocks (Read, Edit, Write,
 * MultiEdit…) whose `input` carries `file_path`. We project those into steps.
 */
export interface ClaudeCodeSession {
  sessionId?: string;
  title?: string;
  messages?: ClaudeMessage[];
}

export interface ClaudeMessage {
  role?: string;
  timestamp?: string;
  /** Content blocks; tool_use blocks carry name + input. */
  content?: ClaudeContentBlock[];
}

export interface ClaudeContentBlock {
  type?: string;
  name?: string;
  input?: Record<string, unknown>;
}

function pathFromClaudeInput(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined;
  const candidates = [input.file_path, input.path, input.filePath, input.notebook_path];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c;
  }
  return undefined;
}

function diffRangeFromClaudeInput(
  input: Record<string, unknown> | undefined,
): DiffRange | undefined {
  if (!input) return undefined;
  // Explicit range first.
  const explicit = coerceDiffRange(input.range ?? input.diffRange);
  if (explicit) return explicit;
  // Read tools carry offset/limit; project to a line range.
  const offset = input.offset;
  const limit = input.limit;
  if (typeof offset === 'number' && typeof limit === 'number') {
    return coerceDiffRange({ start: offset, end: offset + limit });
  }
  return undefined;
}

/** Convert a Claude Code session transcript into a canonical AgentTrace. */
export function adaptClaudeCodeSession(input: unknown): AgentTrace {
  if (!isObject(input)) {
    throw new TraceParseError('Claude Code session must be a JSON object.');
  }
  const messages = Array.isArray(input.messages) ? (input.messages as ClaudeMessage[]) : [];
  const base = Date.now();
  const steps: TraceStep[] = [];
  let seq = 0;

  for (const msg of messages) {
    if (!isObject(msg)) continue;
    // Only assistant tool calls touch files.
    if (msg.role !== undefined && msg.role !== 'assistant') continue;
    const blocks = Array.isArray(msg.content) ? msg.content : [];
    for (const block of blocks) {
      if (!isObject(block)) continue;
      if (block.type !== 'tool_use') continue;
      const name = typeof block.name === 'string' ? block.name : '';
      const action = verbToAction(name);
      if (!action) continue;
      const file = pathFromClaudeInput(block.input);
      if (!file) continue;

      const timestamp = isIsoTimestamp(msg.timestamp)
        ? msg.timestamp
        : synthTimestamp(base, seq);
      const step: TraceStep = { file, action, timestamp, label: name };
      const range = diffRangeFromClaudeInput(block.input);
      if (range) step.diffRange = range;
      steps.push(step);
      seq++;
    }
  }

  if (steps.length === 0) {
    throw new TraceParseError('Claude Code session contained no file tool calls.');
  }

  const trace: AgentTrace = { version: 1, source: 'claude-code', steps };
  if (typeof input.sessionId === 'string') trace.runId = input.sessionId;
  if (typeof input.title === 'string') trace.title = input.title;
  return trace;
}

/* ── unified entry point ──────────────────────────────────── */

/**
 * Parse JSON of unknown shape into a canonical AgentTrace.
 *
 * Detection order:
 *  1. Canonical (`version: 1` + `steps`) — validated strictly.
 *  2. Claude Code session (`messages` array).
 *  3. Forge run log (`events` array).
 * Throws TraceParseError if none match.
 */
export function parseTraceInput(input: unknown): AgentTrace {
  if (isObject(input)) {
    if (input.version === 1 && Array.isArray(input.steps)) {
      return parseTrace(input);
    }
    if (Array.isArray(input.messages)) {
      return adaptClaudeCodeSession(input);
    }
    if (Array.isArray(input.events)) {
      return adaptForgeRunLog(input);
    }
  }
  throw new TraceParseError(
    'Unrecognised trace format. Expected a canonical AgentTrace, a Claude Code session, or a Forge run log.',
  );
}

/** Parse a raw JSON string into a canonical AgentTrace. */
export function parseTraceJSON(json: string): AgentTrace {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new TraceParseError('Trace is not valid JSON.');
  }
  return parseTraceInput(data);
}
