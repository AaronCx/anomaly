import { describe, it, expect } from 'vitest';
import {
  parseTrace,
  parseTraceInput,
  parseTraceJSON,
  adaptForgeRunLog,
  adaptClaudeCodeSession,
  TraceParseError,
} from '../lib/trace/parse';
import { buildReplay, countResolved, NodeIndex, normalizePath } from '../lib/trace/replay';
import type { AgentTrace } from '../lib/trace/types';
import type { GraphData, GraphNode } from '../lib/graph/types';

/* ── Fixtures ─────────────────────────────────────────────── */

function node(id: string): GraphNode {
  return {
    id,
    filePath: id,
    label: id.split('/').pop() ?? id,
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

const GOOD_TRACE: AgentTrace = {
  version: 1,
  source: 'generic',
  runId: 'run-1',
  title: 'Demo run',
  steps: [
    { file: 'src/a.ts', action: 'read', timestamp: '2026-06-09T10:00:00Z' },
    {
      file: 'src/b.ts',
      action: 'modified',
      timestamp: '2026-06-09T10:00:05Z',
      diffRange: { start: 12, end: 20 },
    },
    { file: 'src/a.ts', action: 'modified', timestamp: '2026-06-09T10:00:10Z' },
  ],
};

/* ── parseTrace (canonical schema) ────────────────────────── */

describe('parseTrace', () => {
  it('accepts a valid canonical trace and normalises it', () => {
    const t = parseTrace(GOOD_TRACE);
    expect(t.version).toBe(1);
    expect(t.source).toBe('generic');
    expect(t.runId).toBe('run-1');
    expect(t.steps).toHaveLength(3);
    expect(t.steps[1].diffRange).toEqual({ start: 12, end: 20 });
  });

  it('orders an inverted diff range (start > end)', () => {
    const t = parseTrace({
      version: 1,
      source: 'generic',
      steps: [
        { file: 'x.ts', action: 'modified', timestamp: '2026-06-09T10:00:00Z', diffRange: { start: 30, end: 5 } },
      ],
    });
    expect(t.steps[0].diffRange).toEqual({ start: 5, end: 30 });
  });

  it('rejects a non-object', () => {
    expect(() => parseTrace(null)).toThrow(TraceParseError);
    expect(() => parseTrace('nope')).toThrow(TraceParseError);
  });

  it('rejects a wrong version', () => {
    expect(() => parseTrace({ version: 2, source: 'generic', steps: [] })).toThrow(/version/i);
  });

  it('rejects an invalid source', () => {
    expect(() =>
      parseTrace({ version: 1, source: 'bogus', steps: GOOD_TRACE.steps }),
    ).toThrow(/source/i);
  });

  it('rejects empty steps', () => {
    expect(() => parseTrace({ version: 1, source: 'generic', steps: [] })).toThrow(/at least one/i);
  });

  it('rejects an invalid action', () => {
    expect(() =>
      parseTrace({
        version: 1,
        source: 'generic',
        steps: [{ file: 'a.ts', action: 'frobnicate', timestamp: '2026-06-09T10:00:00Z' }],
      }),
    ).toThrow(/action/i);
  });

  it('rejects a missing file', () => {
    expect(() =>
      parseTrace({
        version: 1,
        source: 'generic',
        steps: [{ file: '   ', action: 'read', timestamp: '2026-06-09T10:00:00Z' }],
      }),
    ).toThrow(/file/i);
  });

  it('rejects a non-ISO timestamp', () => {
    expect(() =>
      parseTrace({
        version: 1,
        source: 'generic',
        steps: [{ file: 'a.ts', action: 'read', timestamp: 'yesterday' }],
      }),
    ).toThrow(/timestamp/i);
  });
});

describe('parseTraceJSON', () => {
  it('parses a JSON string', () => {
    const t = parseTraceJSON(JSON.stringify(GOOD_TRACE));
    expect(t.steps).toHaveLength(3);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseTraceJSON('{ not json')).toThrow(/valid JSON/i);
  });
});

/* ── Forge run-log adapter ────────────────────────────────── */

describe('adaptForgeRunLog', () => {
  it('converts a Forge run log into a canonical trace', () => {
    const log = {
      runId: 'forge-42',
      title: 'Add feature',
      events: [
        { type: 'message', content: 'thinking' },
        { type: 'tool', tool: 'read_file', args: { path: 'src/a.ts' }, timestamp: '2026-06-09T10:00:00Z' },
        { type: 'tool', tool: 'edit_file', args: { file_path: 'src/b.ts', range: { start: 3, end: 9 } }, ts: '2026-06-09T10:00:01Z' },
        { type: 'tool', tool: 'bash', args: { command: 'ls' } },
        { type: 'tool', tool: 'write_file', path: 'src/c.ts' },
      ],
    };
    const t = adaptForgeRunLog(log);
    expect(t.source).toBe('forge');
    expect(t.runId).toBe('forge-42');
    expect(t.steps.map((s) => [s.file, s.action])).toEqual([
      ['src/a.ts', 'read'],
      ['src/b.ts', 'modified'],
      ['src/c.ts', 'created'],
    ]);
    expect(t.steps[1].diffRange).toEqual({ start: 3, end: 9 });
    expect(t.steps[0].timestamp).toBe('2026-06-09T10:00:00Z');
  });

  it('throws when no file-touching events exist', () => {
    expect(() => adaptForgeRunLog({ events: [{ type: 'tool', tool: 'bash' }] })).toThrow(TraceParseError);
  });
});

/* ── Claude Code session adapter ──────────────────────────── */

describe('adaptClaudeCodeSession', () => {
  it('converts a Claude Code session transcript into a canonical trace', () => {
    const session = {
      sessionId: 'sess-7',
      title: 'Refactor',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'go' }] },
        {
          role: 'assistant',
          timestamp: '2026-06-09T10:00:00Z',
          content: [
            { type: 'text', text: 'reading' },
            { type: 'tool_use', name: 'Read', input: { file_path: 'src/a.ts', offset: 10, limit: 5 } },
            { type: 'tool_use', name: 'Edit', input: { file_path: 'src/b.ts' } },
          ],
        },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }],
        },
      ],
    };
    const t = adaptClaudeCodeSession(session);
    expect(t.source).toBe('claude-code');
    expect(t.runId).toBe('sess-7');
    expect(t.steps.map((s) => [s.file, s.action])).toEqual([
      ['src/a.ts', 'read'],
      ['src/b.ts', 'modified'],
    ]);
    // Read offset/limit projects to a line range.
    expect(t.steps[0].diffRange).toEqual({ start: 10, end: 15 });
  });

  it('throws when no file tool calls exist', () => {
    expect(() =>
      adaptClaudeCodeSession({ messages: [{ role: 'assistant', content: [{ type: 'text', text: 'hi' }] }] }),
    ).toThrow(TraceParseError);
  });
});

/* ── parseTraceInput dispatch ─────────────────────────────── */

describe('parseTraceInput', () => {
  it('detects canonical traces', () => {
    expect(parseTraceInput(GOOD_TRACE).source).toBe('generic');
  });
  it('detects Claude Code sessions', () => {
    const t = parseTraceInput({
      messages: [{ role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'a.ts' } }] }],
    });
    expect(t.source).toBe('claude-code');
  });
  it('detects Forge run logs', () => {
    const t = parseTraceInput({ events: [{ type: 'tool', tool: 'read', path: 'a.ts' }] });
    expect(t.source).toBe('forge');
  });
  it('rejects unrecognised shapes', () => {
    expect(() => parseTraceInput({ foo: 'bar' })).toThrow(/Unrecognised/i);
  });
});

/* ── Path → node matching ─────────────────────────────────── */

describe('NodeIndex', () => {
  it('normalizePath strips leading ./ and backslashes', () => {
    expect(normalizePath('./src\\a.ts')).toBe('src/a.ts');
    expect(normalizePath('/src/a.ts')).toBe('src/a.ts');
  });

  it('resolves an exact path', () => {
    const idx = new NodeIndex(graph(['src/a.ts', 'src/b.ts']));
    expect(idx.resolve('src/a.ts')).toBe('src/a.ts');
    expect(idx.resolve('./src/a.ts')).toBe('src/a.ts');
  });

  it('resolves by suffix when the trace path is deeper', () => {
    const idx = new NodeIndex(graph(['src/a.ts']));
    expect(idx.resolve('/repo/project/src/a.ts')).toBe('src/a.ts');
  });

  it('falls back to an unambiguous basename', () => {
    const idx = new NodeIndex(graph(['lib/deep/util.ts']));
    expect(idx.resolve('util.ts')).toBe('lib/deep/util.ts');
  });

  it('does not resolve an ambiguous basename', () => {
    const idx = new NodeIndex(graph(['a/util.ts', 'b/util.ts']));
    expect(idx.resolve('util.ts')).toBeNull();
  });

  it('returns null for an unknown file', () => {
    const idx = new NodeIndex(graph(['src/a.ts']));
    expect(idx.resolve('nope.ts')).toBeNull();
  });
});

/* ── Replay ───────────────────────────────────────────────── */

describe('buildReplay', () => {
  const g = graph(['src/a.ts', 'src/b.ts', 'src/c.ts']);

  it('produces one state per step with accumulating read/modified sets', () => {
    const states = buildReplay(GOOD_TRACE, g);
    expect(states).toHaveLength(3);

    // Step 0: read a.ts
    expect(states[0].active).toBe('src/a.ts');
    expect([...states[0].read]).toEqual(['src/a.ts']);
    expect(states[0].modified.size).toBe(0);
    expect(states[0].path).toEqual([]);

    // Step 1: modify b.ts — read still has a, modified gains b, path a→b
    expect(states[1].active).toBe('src/b.ts');
    expect([...states[1].read]).toEqual(['src/a.ts']);
    expect([...states[1].modified]).toEqual(['src/b.ts']);
    expect(states[1].path).toEqual([{ source: 'src/a.ts', target: 'src/b.ts' }]);

    // Step 2: modify a.ts — modified gains a, path b→a appended
    expect(states[2].active).toBe('src/a.ts');
    expect([...states[2].modified].sort()).toEqual(['src/a.ts', 'src/b.ts']);
    expect(states[2].path).toEqual([
      { source: 'src/a.ts', target: 'src/b.ts' },
      { source: 'src/b.ts', target: 'src/a.ts' },
    ]);
  });

  it('is deterministic — same inputs yield identical states', () => {
    const a = buildReplay(GOOD_TRACE, g);
    const b = buildReplay(GOOD_TRACE, g);
    expect(JSON.stringify(serialise(a))).toBe(JSON.stringify(serialise(b)));
  });

  it('marks unresolved steps as active=null and skips them in the path', () => {
    const trace: AgentTrace = {
      version: 1,
      source: 'generic',
      steps: [
        { file: 'src/a.ts', action: 'read', timestamp: '2026-06-09T10:00:00Z' },
        { file: 'ghost.ts', action: 'modified', timestamp: '2026-06-09T10:00:01Z' },
        { file: 'src/c.ts', action: 'modified', timestamp: '2026-06-09T10:00:02Z' },
      ],
    };
    const states = buildReplay(trace, g);
    expect(states[1].active).toBeNull();
    // No hop into the ghost; the next hop is a→c (skipping the unresolved step).
    expect(states[2].path).toEqual([{ source: 'src/a.ts', target: 'src/c.ts' }]);
  });

  it('does not add a self-loop when the same file is touched twice in a row', () => {
    const trace: AgentTrace = {
      version: 1,
      source: 'generic',
      steps: [
        { file: 'src/a.ts', action: 'read', timestamp: '2026-06-09T10:00:00Z' },
        { file: 'src/a.ts', action: 'modified', timestamp: '2026-06-09T10:00:01Z' },
      ],
    };
    const states = buildReplay(trace, g);
    expect(states[1].path).toEqual([]);
    expect([...states[1].read]).toEqual(['src/a.ts']);
    expect([...states[1].modified]).toEqual(['src/a.ts']);
  });

  it('tracks deletions separately', () => {
    const trace: AgentTrace = {
      version: 1,
      source: 'generic',
      steps: [{ file: 'src/a.ts', action: 'deleted', timestamp: '2026-06-09T10:00:00Z' }],
    };
    const states = buildReplay(trace, g);
    expect([...states[0].deleted]).toEqual(['src/a.ts']);
    expect(states[0].read.size).toBe(0);
    expect(states[0].modified.size).toBe(0);
  });
});

describe('countResolved', () => {
  it('counts steps that map to a node', () => {
    const g = graph(['src/a.ts', 'src/b.ts']);
    expect(countResolved(GOOD_TRACE, g)).toBe(3); // a, b, a all resolve
    const trace: AgentTrace = {
      version: 1,
      source: 'generic',
      steps: [
        { file: 'src/a.ts', action: 'read', timestamp: '2026-06-09T10:00:00Z' },
        { file: 'ghost.ts', action: 'read', timestamp: '2026-06-09T10:00:01Z' },
      ],
    };
    expect(countResolved(trace, g)).toBe(1);
  });
});

function serialise(states: ReturnType<typeof buildReplay>) {
  return states.map((s) => ({
    step: s.step,
    active: s.active,
    read: [...s.read],
    modified: [...s.modified],
    deleted: [...s.deleted],
    path: s.path,
  }));
}
