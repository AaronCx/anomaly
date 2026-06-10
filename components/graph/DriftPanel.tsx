'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, ShieldCheck } from 'lucide-react';
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
}

/**
 * Architecture conformance panel: a drift score (share of checked dependencies
 * that break the declared rules) plus the list of violating edges. Rendered
 * only when a .anomaly.yml was loaded.
 */
export function DriftPanel({ drift, onSelectViolation }: DriftPanelProps) {
  const [open, setOpen] = useState(true);
  const color = driftColor(drift.driftScore);
  const clean = drift.violations.length === 0;

  return (
    <div className="absolute top-4 right-4 z-20 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/95 text-sm shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2"
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
          <span className="font-mono font-semibold" style={{ color }}>
            {drift.driftScore}% drift
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] px-3 py-2">
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
                    className="w-full rounded px-2 py-1 text-left hover:bg-[var(--color-bg)]"
                  >
                    <span className="flex items-center gap-1 font-mono text-xs">
                      <span className="text-[var(--color-text)]">{shortPath(v.source)}</span>
                      <span className="text-[#ef4444]">→</span>
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
      )}
    </div>
  );
}
