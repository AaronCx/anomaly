'use client';

import { useId, useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriftReport, Violation } from '@/lib/rules/types';

function shortPath(p: string): string {
  return p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p;
}

function driftColor(score: number): string {
  if (score === 0) return '#22c55e';
  if (score < 10) return '#84cc16';
  if (score < 25) return '#eab308';
  if (score < 50) return '#f97316';
  return '#ef4444';
}

export interface DriftPanelProps {
  drift: DriftReport;
  onSelectViolation?: (v: Violation) => void;
  /** Appended last so the page can reposition the panel. */
  className?: string;
}

/**
 * Architecture conformance panel: a drift score (share of checked dependencies
 * that break the declared rules) plus the list of violating edges. Rendered
 * only when a .anomaly.yml was loaded.
 */
export function DriftPanel({ drift, onSelectViolation, className }: DriftPanelProps) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const color = driftColor(drift.driftScore);
  const clean = drift.violations.length === 0;
  // Clamp the meter so a hairline of fill always shows once there is any drift.
  const meterPct = Math.max(0, Math.min(100, drift.driftScore));

  return (
    <div
      className={cn(
        'glass animate-fade-in absolute top-4 right-4 z-20 w-72 overflow-hidden rounded-xl text-sm',
        'transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-pop)]',
        className,
      )}
    >
      {/* faint top inner highlight for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10"
      />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
      >
        <span className="flex items-center gap-2 font-medium">
          {clean ? (
            <ShieldCheck size={16} style={{ color }} />
          ) : (
            <ShieldAlert size={16} style={{ color }} />
          )}
          Architecture
        </span>
        <span className="flex items-center gap-2">
          <span className="font-[var(--font-mono)] font-semibold" style={{ color }}>
            {drift.driftScore}% drift
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Drift magnitude meter. */}
      <div className="px-4 pb-3" aria-hidden>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${meterPct}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <div
        id={bodyId}
        className={cn(
          'grid transition-all duration-200 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <div className="mb-2 text-xs text-[var(--color-text-muted)]">
              {clean ? (
                <>No violations across {drift.checkedEdges} checked dependencies.</>
              ) : (
                <>
                  {drift.violations.length} violation
                  {drift.violations.length === 1 ? '' : 's'} of {drift.checkedEdges} checked
                  dependencies.
                </>
              )}
            </div>

            {!clean && (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {drift.violations.map((v, i) => (
                  <li key={`${v.source}->${v.target}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onSelectViolation?.(v)}
                      className="w-full rounded-lg border-l-2 px-3 py-2 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
                      style={{ borderLeftColor: 'var(--color-danger)' }}
                    >
                      <span className="flex items-center gap-1 font-[var(--font-mono)] text-xs">
                        <span className="text-[var(--color-text)]">{shortPath(v.source)}</span>
                        <span className="text-[var(--color-danger)]">→</span>
                        <span className="text-[var(--color-text)]">{shortPath(v.target)}</span>
                      </span>
                      <span className="block text-[11px] text-[var(--color-text-muted)]">
                        {v.kind === 'layer-direction'
                          ? `backward: ${v.fromLayer} → ${v.toLayer}`
                          : 'forbidden import'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
