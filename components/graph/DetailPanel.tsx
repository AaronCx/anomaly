'use client';

import { useEffect, useRef } from 'react';
import type { GraphNode, GraphData } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import CodeViewer from './CodeViewer';

interface DetailPanelProps {
  node: GraphNode;
  graphData: GraphData;
  fileContent?: string;
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
  className?: string;
}

const SECTION_HEADER =
  'mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]';

export default function DetailPanel({
  node,
  graphData,
  fileContent,
  onClose,
  onNavigate,
  className,
}: DetailPanelProps) {
  const color = FILE_TYPE_COLORS[node.fileType] || FILE_TYPE_COLORS.unknown;
  const panelRef = useRef<HTMLDivElement>(null);

  // Dialog behaviour: window-level Escape, move focus into the panel on open,
  // restore focus to the previously-focused element on close, and trap focus.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Move focus into the panel on open.
    panelRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  // Find connected nodes, deduped — a pair can be joined by several edge
  // types (import + its reverse export + call), which would otherwise list
  // (and key) the same neighbour multiple times.
  const connectedIds = new Set<string>();
  for (const e of graphData.edges) {
    if (e.source === node.id) connectedIds.add(e.target);
    else if (e.target === node.id) connectedIds.add(e.source);
  }
  const connectedNodes = [...connectedIds]
    .map((id) => graphData.nodes.find((n) => n.id === id))
    .filter(Boolean) as GraphNode[];

  return (
    <>
      {/* Backdrop scrim */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        onTouchStart={(e) => e.stopPropagation()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${node.label}`}
        tabIndex={-1}
        className={cn(
          'glass-strong animate-slide-in-right fixed right-0 top-0 z-40 flex h-dvh w-[90%] min-w-0 max-w-[600px] flex-col rounded-l-xl outline-none sm:w-[40%] sm:min-w-[360px]',
          className,
        )}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}22` }}
            />
            <span className="truncate font-[var(--font-mono)] text-sm text-[var(--color-text)]">
              {node.label}
            </span>
            <span
              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider"
              style={{
                backgroundColor: color + '22',
                color,
                boxShadow: `inset 0 0 0 1px ${color}33`,
              }}
            >
              {node.fileType}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details panel"
            className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* File path */}
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
              {node.filePath}
            </p>
            <div className="mt-2 flex gap-4 font-[var(--font-mono)] text-xs text-[var(--color-text-muted)]">
              <span>{node.loc} LOC</span>
              <span>Complexity: {node.complexity}</span>
            </div>
          </div>

          {/* Exports */}
          {node.exports.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h3 className={SECTION_HEADER}>Exports ({node.exports.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {node.exports.map((exp, i) => (
                  <span
                    key={`${exp}-${i}`}
                    className="rounded-md bg-white/5 px-2 py-0.5 font-[var(--font-mono)] text-[11px] text-[var(--color-text)]"
                  >
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Functions */}
          {node.functions.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h3 className={SECTION_HEADER}>Functions ({node.functions.length})</h3>
              <div className="space-y-1">
                {node.functions.map((fn, i) => (
                  <div key={`${fn.name}-${fn.line}-${i}`} className="flex items-center gap-2">
                    <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-accent)]">
                      {fn.name}
                    </span>
                    <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                      ({fn.params.join(', ')})
                    </span>
                    {fn.isExported && (
                      <span className="text-[9px] text-[var(--color-success)]">exported</span>
                    )}
                    <span className="ml-auto font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                      L{fn.line}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Imports */}
          {node.imports.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h3 className={SECTION_HEADER}>Imports ({node.imports.length})</h3>
              <div className="space-y-0.5">
                {node.imports.map((imp, i) => (
                  <p
                    key={`${imp}-${i}`}
                    className="font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]"
                  >
                    {imp}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Connected files */}
          {connectedNodes.length > 0 && (
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <h3 className={SECTION_HEADER}>Connected Files ({connectedNodes.length})</h3>
              <div className="space-y-1">
                {connectedNodes.map((cn_) => {
                  const cnColor =
                    FILE_TYPE_COLORS[cn_.fileType] || FILE_TYPE_COLORS.unknown;
                  return (
                    <button
                      key={cn_.id}
                      onClick={() => onNavigate(cn_.id)}
                      className="group flex w-full items-center gap-2 rounded-lg border-l-2 border-transparent px-2 py-1 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                    >
                      <span
                        className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: cnColor }}
                      />
                      <span className="truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text)]">
                        {cn_.label}
                      </span>
                      <span className="ml-auto font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                        {cn_.loc} LOC
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Code viewer */}
          {fileContent && (
            <div className="px-4 py-3">
              <h3 className={SECTION_HEADER}>Source</h3>
              <CodeViewer code={fileContent} filePath={node.filePath} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
