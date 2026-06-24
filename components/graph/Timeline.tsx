'use client';

import { useEffect, useRef } from 'react';
import { Play, Pause, History } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  /** Appended last so the page can reposition the panel. */
  className?: string;
}

/**
 * Timeline scrubber: a slider over the sampled commits with play/pause.
 * Scrubbing or playing advances `index`, which the page uses to swap the
 * rendered GraphData. Matches the shared glass-panel conventions.
 */
export function Timeline({
  snapshots,
  index,
  onIndexChange,
  playing,
  onTogglePlay,
  stepMs = 1400,
  className,
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

  const progress = last > 0 ? (index / last) * 100 : 0;

  return (
    <div
      className={cn(
        'panel-range glass animate-fade-in-up absolute bottom-4 left-1/2 z-30 w-[min(620px,92vw)]',
        '-translate-x-1/2 rounded-xl px-4 py-3 transition-shadow duration-200 ease-out',
        'hover:shadow-[var(--shadow-pop)]',
        className,
      )}
    >
      {/* faint top inner highlight for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-white/10"
      />

      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--color-text)]">
          <History size={14} className="text-[var(--color-accent)]" />
          History
          <span className="font-[var(--font-mono)] text-[var(--color-text-muted)]">
            {index + 1} / {snapshots.length}
          </span>
        </span>
        {current && (
          <span className="truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
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
          value={index}
          aria-label="Timeline scrubber"
          onChange={(e) => onIndexChange(Number(e.target.value))}
          style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
          className="panel-range__input w-full"
        />
      </div>

      {current?.message && (
        <p className="mt-2 truncate text-[11px] text-[var(--color-text-muted)]" title={current.message}>
          {current.message}
        </p>
      )}

      <RangeStyles />
    </div>
  );
}

/**
 * Explicit styling for the native range input — accent thumb with a soft glow,
 * focus-visible ring, and an accent-gradient progress fill left of the thumb.
 * Scoped via the `.panel-range` ancestor class so it can be shared by panels
 * without touching globals.css.
 */
export function RangeStyles() {
  return (
    <style>{`
      .panel-range__input {
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        cursor: pointer;
        border-radius: 9999px;
        background:
          linear-gradient(
            to right,
            var(--color-accent-deep) 0%,
            var(--color-accent) var(--range-progress, 0%),
            var(--color-border) var(--range-progress, 0%),
            var(--color-border) 100%
          );
        outline: none;
        transition: background 80ms linear;
      }
      .panel-range__input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        height: 14px;
        width: 14px;
        border-radius: 9999px;
        background: var(--color-accent-bright);
        border: 2px solid var(--color-bg);
        box-shadow: 0 0 0 1px var(--color-accent), var(--shadow-glow);
        transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
      }
      .panel-range__input::-moz-range-thumb {
        height: 14px;
        width: 14px;
        border-radius: 9999px;
        background: var(--color-accent-bright);
        border: 2px solid var(--color-bg);
        box-shadow: 0 0 0 1px var(--color-accent), var(--shadow-glow);
        transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
      }
      .panel-range__input::-moz-range-progress {
        height: 6px;
        border-radius: 9999px;
        background: linear-gradient(to right, var(--color-accent-deep), var(--color-accent));
      }
      .panel-range__input::-moz-range-track {
        height: 6px;
        border-radius: 9999px;
        background: var(--color-border);
      }
      .panel-range__input:hover::-webkit-slider-thumb { transform: scale(1.12); }
      .panel-range__input:hover::-moz-range-thumb { transform: scale(1.12); }
      .panel-range__input:active::-webkit-slider-thumb { transform: scale(1.2); }
      .panel-range__input:active::-moz-range-thumb { transform: scale(1.2); }
      .panel-range__input:focus-visible::-webkit-slider-thumb {
        box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent), var(--shadow-glow);
      }
      .panel-range__input:focus-visible::-moz-range-thumb {
        box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent), var(--shadow-glow);
      }
    `}</style>
  );
}
