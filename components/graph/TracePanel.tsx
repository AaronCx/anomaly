'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Route, Upload, X, Eye, Pencil, FilePlus2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentTrace, TraceAction } from '@/lib/trace/types';
import { parseTraceJSON, TraceParseError } from '@/lib/trace/parse';
import type { ReplayState } from '@/lib/trace/replay';
import { RangeStyles } from './Timeline';

const ACTION_META: Record<TraceAction, { color: string; Icon: typeof Eye; label: string }> = {
  read: { color: '#3b82f6', Icon: Eye, label: 'read' },
  modified: { color: '#f59e0b', Icon: Pencil, label: 'modified' },
  created: { color: '#22c55e', Icon: FilePlus2, label: 'created' },
  deleted: { color: '#ef4444', Icon: Trash2, label: 'deleted' },
};

function fileLabel(path: string): string {
  const norm = path.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? norm : norm.slice(idx + 1);
}

export interface TracePanelProps {
  /** The loaded trace, or null when nothing is loaded yet. */
  trace: AgentTrace | null;
  /** Replay states (one per step) for the loaded trace + active graph. */
  states: ReplayState[];
  /** Current step index. */
  index: number;
  onIndexChange: (i: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** Called with a freshly parsed trace, or null to clear. */
  onLoadTrace: (trace: AgentTrace | null) => void;
  /** How many of the trace's steps resolved to a graph node. */
  resolvedCount: number;
  /** Milliseconds each step is shown while playing. */
  stepMs?: number;
  /** Appended last so the page can reposition the panel. */
  className?: string;
}

/** Shared root geometry/material for both loader and player views. */
const PANEL_ROOT =
  'panel-range glass animate-fade-in-up absolute bottom-4 left-1/2 z-30 w-[min(620px,92vw)] ' +
  '-translate-x-1/2 rounded-xl px-4 py-3 transition-shadow duration-200 ease-out ' +
  'hover:shadow-[var(--shadow-pop)]';

/** Field recipe shared by the URL input + paste textarea. */
const FIELD =
  'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm ' +
  'text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] ' +
  'focus:ring-2 focus:ring-[var(--color-accent)]/25 placeholder:text-[var(--color-text-faint)]';

/** Primary button recipe (Fetch, Load pasted trace). */
const PRIMARY =
  'rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg)] ' +
  'transition hover:bg-[var(--color-accent-bright)] active:scale-[0.98] ' +
  'disabled:opacity-50 disabled:pointer-events-none';

/** Ghost button recipe (Upload JSON). */
const GHOST =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 ' +
  'text-sm text-[var(--color-text-muted)] transition hover:bg-white/[0.05] hover:text-[var(--color-text)]';

/**
 * Agent-trace overlay control: load a trace (file / paste / URL), then a step
 * scrubber with play/pause that drives the replay. Mirrors the Timeline surface
 * and playback conventions. Visible only when trace mode is engaged by the page.
 */
export function TracePanel({
  trace,
  states,
  index,
  onIndexChange,
  playing,
  onTogglePlay,
  onLoadTrace,
  resolvedCount,
  stepMs = 1100,
  className,
}: TracePanelProps) {
  const [paste, setPaste] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const last = states.length - 1;

  // Playback: advance one step per tick; stop at the end. Matches Timeline.
  const onIndexChangeRef = useRef(onIndexChange);
  const onTogglePlayRef = useRef(onTogglePlay);
  useEffect(() => { onIndexChangeRef.current = onIndexChange; }, [onIndexChange]);
  useEffect(() => { onTogglePlayRef.current = onTogglePlay; }, [onTogglePlay]);

  useEffect(() => {
    if (!playing || states.length === 0) return;
    if (index >= last) {
      onTogglePlayRef.current();
      return;
    }
    const id = setTimeout(() => {
      onIndexChangeRef.current(Math.min(index + 1, last));
    }, stepMs);
    return () => clearTimeout(id);
  }, [playing, index, last, stepMs, states.length]);

  const ingest = useCallback((json: string) => {
    try {
      const parsed = parseTraceJSON(json);
      setError(null);
      onLoadTrace(parsed);
    } catch (err) {
      setError(err instanceof TraceParseError ? err.message : 'Failed to parse trace.');
    }
  }, [onLoadTrace]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result ?? ''));
    reader.onerror = () => setError('Could not read file.');
    reader.readAsText(file);
  }, [ingest]);

  const handleUrl = useCallback(async () => {
    if (!url.trim()) return;
    setLoadingUrl(true);
    setError(null);
    try {
      const res = await fetch(url.trim());
      if (!res.ok) throw new Error(`Fetch failed (${res.status}).`);
      ingest(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch URL.');
    } finally {
      setLoadingUrl(false);
    }
  }, [url, ingest]);

  /* ── Loader view (no trace yet) ──────────────────────────── */
  if (!trace || states.length === 0) {
    return (
      <div className={cn(PANEL_ROOT, className)}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-white/10"
        />

        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--color-text)]">
          <Route size={14} className="text-[var(--color-accent)]" />
          Agent Trace
          <span className="text-[var(--color-text-muted)]">load a run to replay it on the graph</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(GHOST, 'shrink-0')}
            >
              <Upload size={14} /> Upload JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleUrl(); }}
              placeholder="…or paste a trace URL"
              aria-label="Trace URL"
              className={cn(FIELD, 'w-full min-w-0 text-xs sm:w-auto sm:flex-1')}
            />
            <button
              type="button"
              onClick={() => void handleUrl()}
              disabled={loadingUrl || !url.trim()}
              className={cn(PRIMARY, 'shrink-0 px-3 text-xs')}
            >
              {loadingUrl ? 'Loading…' : 'Fetch'}
            </button>
          </div>

          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="…or paste trace JSON here (canonical, Claude Code session, or Forge run log)"
            rows={2}
            aria-label="Trace JSON"
            className={cn(FIELD, 'w-full resize-none font-[var(--font-mono)] text-[11px]')}
          />
          {paste.trim() && (
            <button
              type="button"
              onClick={() => ingest(paste)}
              className={cn(PRIMARY, 'self-start px-3 text-xs')}
            >
              Load pasted trace
            </button>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-[11px] text-[var(--color-danger)]"
            >
              {error}
            </p>
          )}
        </div>

        <RangeStyles />
      </div>
    );
  }

  /* ── Player view (trace loaded) ──────────────────────────── */
  const state = states[Math.min(index, last)];
  const meta = ACTION_META[state.raw.action];
  const StepIcon = meta.Icon;
  const progress = last > 0 ? (Math.min(index, last) / last) * 100 : 0;

  return (
    <div className={cn(PANEL_ROOT, className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-white/10"
      />

      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-text)]">
          <Route size={14} className="text-[var(--color-accent)]" />
          {trace.title || trace.runId || 'Agent Trace'}
          <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">
            {index + 1} / {states.length}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]" title="steps mapped to a graph node">
            {resolvedCount}/{states.length} mapped
          </span>
          <button
            type="button"
            onClick={() => onLoadTrace(null)}
            title="Clear trace"
            aria-label="Clear trace"
            className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95"
          >
            <X size={14} />
          </button>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          title={playing ? 'Pause' : 'Play'}
          aria-label={playing ? 'Pause' : 'Play'}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-lg p-2 transition active:scale-95',
            playing
              ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)]'
              : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text)]',
          )}
        >
          {playing ? (
            <Pause size={16} className="animate-pulse-soft" />
          ) : (
            <Play size={16} />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={Math.min(index, last)}
          aria-label="Trace step scrubber"
          onChange={(e) => onIndexChange(Number(e.target.value))}
          style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
          className="panel-range__input w-full"
        />
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span
          className="flex items-center gap-1 rounded-full px-2.5 py-1 font-medium"
          style={{
            color: meta.color,
            backgroundColor: `${meta.color}22`,
            boxShadow: `inset 0 0 0 1px ${meta.color}33`,
          }}
        >
          <StepIcon size={12} /> {meta.label}
        </span>
        <span
          className="truncate font-[var(--font-mono)] text-[var(--color-text)]"
          title={state.raw.file}
        >
          {fileLabel(state.raw.file)}
          {state.raw.diffRange && (
            <span className="ml-1 text-[var(--color-text-muted)]">
              L{state.raw.diffRange.start}–{state.raw.diffRange.end}
            </span>
          )}
        </span>
        {!state.active && (
          <span className="ml-auto shrink-0 text-[var(--color-text-muted)]" title="file not present in this graph">
            (unmapped)
          </span>
        )}
      </div>

      <RangeStyles />
    </div>
  );
}
