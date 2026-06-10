'use client';

import { useEffect, useRef } from 'react';
import { Play, Pause, History } from 'lucide-react';
import type { Snapshot } from '@/lib/history/types';

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function shortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface TimelineProps {
  snapshots: Snapshot[];
  /** Index of the currently-rendered snapshot. */
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** Milliseconds each snapshot is shown while playing. */
  stepMs?: number;
}

/**
 * Timeline scrubber: a slider over the sampled commits with play/pause.
 * Scrubbing or playing advances `index`, which the page uses to swap the
 * rendered GraphData. Matches the DriftPanel surface/border conventions.
 */
export function Timeline({
  snapshots,
  index,
  onIndexChange,
  playing,
  onTogglePlay,
  stepMs = 1400,
}: TimelineProps) {
  const last = snapshots.length - 1;
  const current = snapshots[index]?.commit;

  // Drive playback. When playing, advance one snapshot per tick; stop at the end.
  const onIndexChangeRef = useRef(onIndexChange);
  const onTogglePlayRef = useRef(onTogglePlay);
  useEffect(() => { onIndexChangeRef.current = onIndexChange; }, [onIndexChange]);
  useEffect(() => { onTogglePlayRef.current = onTogglePlay; }, [onTogglePlay]);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      // Reached the end: stop playback.
      onTogglePlayRef.current();
      return;
    }
    const id = setTimeout(() => {
      onIndexChangeRef.current(Math.min(index + 1, last));
    }, stepMs);
    return () => clearTimeout(id);
  }, [playing, index, last, stepMs]);

  if (snapshots.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 z-30 w-[min(620px,92vw)] -translate-x-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-text)]">
          <History size={14} className="text-[var(--color-accent)]" />
          History
          <span className="text-[var(--color-text-muted)]">
            {index + 1} / {snapshots.length}
          </span>
        </span>
        {current && (
          <span className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">
            {shortSha(current.sha)} &middot; {shortDate(current.date)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          title={playing ? 'Pause' : 'Play'}
          aria-label={playing ? 'Pause' : 'Play'}
          className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--color-text)]"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={index}
          aria-label="Timeline scrubber"
          onChange={(e) => onIndexChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-accent)]"
        />
      </div>

      {current?.message && (
        <p className="mt-2 truncate text-[11px] text-[var(--color-text-muted)]" title={current.message}>
          {current.message}
        </p>
      )}
    </div>
  );
}
