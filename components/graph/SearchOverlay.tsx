'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphData, GraphNode } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { Search, FileCode, Box, Braces } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  type: 'file' | 'function' | 'export';
  nodeId: string;
  label: string;
  detail: string;
  fileType: GraphNode['fileType'];
}

interface SearchOverlayProps {
  data: GraphData;
  open: boolean;
  onClose: () => void;
  onSelect: (nodeId: string) => void;
  className?: string;
}

function buildIndex(data: GraphData): SearchResult[] {
  const results: SearchResult[] = [];

  for (const node of data.nodes) {
    results.push({
      type: 'file',
      nodeId: node.id,
      label: node.label,
      detail: node.filePath,
      fileType: node.fileType,
    });

    for (const fn of node.functions) {
      results.push({
        type: 'function',
        nodeId: node.id,
        label: fn.name,
        detail: `${node.label}:${fn.line}`,
        fileType: node.fileType,
      });
    }

    for (const exp of node.exports) {
      if (!node.functions.some((f) => f.name === exp)) {
        results.push({
          type: 'export',
          nodeId: node.id,
          label: exp,
          detail: node.label,
          fileType: node.fileType,
        });
      }
    }
  }

  return results;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;

  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 80;

  let qi = 0;
  let consecutive = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2;
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : 0;
}

const TYPE_ICONS = {
  file: FileCode,
  function: Braces,
  export: Box,
};

const EXAMPLE_QUERIES = ['DetailPanel', 'parseRepo', 'useGraph', 'route'];

export default function SearchOverlay({
  data,
  open,
  onClose,
  onSelect,
  className,
}: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  // Rebuild the search index whenever the data changes (fixes the stale-index
  // bug from a one-time useState initializer that ignored later data updates).
  const index = useMemo(() => buildIndex(data), [data]);

  const filtered =
    query.length > 0
      ? index
          .filter((r) => fuzzyMatch(query, r.label) || fuzzyMatch(query, r.detail))
          .sort((a, b) => fuzzyScore(query, b.label) - fuzzyScore(query, a.label))
          .slice(0, 30)
      : [];

  // Group results
  const grouped = {
    files: filtered.filter((r) => r.type === 'file'),
    functions: filtered.filter((r) => r.type === 'function'),
    exports: filtered.filter((r) => r.type === 'export'),
  };

  const flatResults = [...grouped.files, ...grouped.functions, ...grouped.exports];

  // Reset and focus the input on open.
  useEffect(() => {
    if (!open) return;
    // Intentional state sync when the palette opens.
    /* eslint-disable react-hooks/set-state-in-effect */
    setQuery('');
    setActiveIdx(0);
    /* eslint-enable react-hooks/set-state-in-effect */
    inputRef.current?.focus();
  }, [open]);

  // Window-level Escape + focus trap while open.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<HTMLElement>(
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleSelect = (result: SearchResult) => {
    onSelect(result.nodeId);
    onClose();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && flatResults[activeIdx]) {
      handleSelect(flatResults[activeIdx]);
    }
  };

  if (!open) return null;

  const optionId = (idx: number) => `search-option-${idx}`;

  const renderGroup = (label: string, items: SearchResult[], startIdx: number) => {
    if (items.length === 0) return null;
    return (
      <div key={label} role="group" aria-label={label}>
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
          {label}
        </div>
        {items.map((r, i) => {
          const globalIdx = startIdx + i;
          const isActive = globalIdx === activeIdx;
          const Icon = TYPE_ICONS[r.type];
          const color = FILE_TYPE_COLORS[r.fileType] || FILE_TYPE_COLORS.unknown;
          return (
            <button
              key={`${r.type}-${r.label}-${r.nodeId}-${i}`}
              id={optionId(globalIdx)}
              role="option"
              aria-selected={isActive}
              className={cn(
                'flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left transition',
                isActive
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12'
                  : 'border-transparent hover:bg-white/[0.04]',
              )}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setActiveIdx(globalIdx)}
            >
              <Icon size={14} style={{ color }} className="flex-shrink-0" />
              <span className="truncate font-[var(--font-mono)] text-xs text-[var(--color-text)]">
                {r.label}
              </span>
              <span className="ml-auto truncate font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
                {r.detail}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search files, functions, and exports"
        className={cn(
          'glass-strong animate-fade-in w-full max-w-lg overflow-hidden rounded-xl',
          className,
        )}
        style={{ animationDuration: '0.18s' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
          <Search size={16} className="flex-shrink-0 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-expanded={flatResults.length > 0}
            aria-controls="search-results"
            aria-activedescendant={
              flatResults.length > 0 ? optionId(activeIdx) : undefined
            }
            aria-autocomplete="list"
            aria-label="Search query"
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search files, functions, exports..."
            className="flex-1 bg-transparent font-[var(--font-mono)] text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
          />
          <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] shadow-[inset_0_-1px_0_var(--color-border)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {flatResults.length > 0 && (
          <div
            id="search-results"
            role="listbox"
            aria-label="Search results"
            className="max-h-[50vh] overflow-y-auto py-1"
          >
            {renderGroup('Files', grouped.files, 0)}
            {renderGroup('Functions', grouped.functions, grouped.files.length)}
            {renderGroup(
              'Exports',
              grouped.exports,
              grouped.files.length + grouped.functions.length,
            )}
          </div>
        )}

        {query.length > 0 && flatResults.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">
            No results for &quot;{query}&quot;
          </div>
        )}

        {/* Pre-query hint */}
        {query.length === 0 && (
          <div className="px-3 py-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
              Try searching
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setQuery(q);
                    setActiveIdx(0);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full bg-white/5 px-2.5 py-1 font-[var(--font-mono)] text-[11px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-accent-bright)]"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-[var(--color-text-faint)]">
              <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 shadow-[inset_0_-1px_0_var(--color-border)]">
                &uarr;&darr;
              </kbd>
              <span>navigate</span>
              <kbd className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 shadow-[inset_0_-1px_0_var(--color-border)]">
                &crarr;
              </kbd>
              <span>open</span>
              <kbd className="ml-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 shadow-[inset_0_-1px_0_var(--color-border)]">
                &#8984;K
              </kbd>
              <span>toggle</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
