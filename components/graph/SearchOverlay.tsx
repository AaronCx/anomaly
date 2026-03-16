'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GraphData, GraphNode } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { Search, FileCode, Box, Braces } from 'lucide-react';

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

export default function SearchOverlay({ data, open, onClose, onSelect }: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [index] = useState(() => buildIndex(data));

  const filtered = query.length > 0
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

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state on open
      setQuery('');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state on open
      setActiveIdx(0);
    }
  }, [open]);

  const handleSelect = (result: SearchResult) => {
    onSelect(result.nodeId);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
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

  const renderGroup = (label: string, items: SearchResult[], startIdx: number) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </div>
        {items.map((r, i) => {
          const globalIdx = startIdx + i;
          const Icon = TYPE_ICONS[r.type];
          const color = FILE_TYPE_COLORS[r.fileType] || FILE_TYPE_COLORS.unknown;
          return (
            <button
              key={`${r.type}-${r.label}-${r.nodeId}-${i}`}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                globalIdx === activeIdx ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setActiveIdx(globalIdx)}
            >
              <Icon size={14} style={{ color }} className="flex-shrink-0" />
              <span className="truncate font-[var(--font-mono)] text-xs text-[var(--color-text)]">
                {r.label}
              </span>
              <span className="ml-auto truncate text-[10px] text-[var(--color-text-muted)]">
                {r.detail}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
          <Search size={16} className="flex-shrink-0 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search files, functions, exports..."
            className="flex-1 bg-transparent font-[var(--font-mono)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none"
          />
          <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {flatResults.length > 0 && (
          <div className="max-h-[50vh] overflow-y-auto py-1">
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
      </div>
    </div>
  );
}
