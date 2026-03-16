'use client';

import { useEffect, useCallback } from 'react';
import type { GraphNode, GraphData } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { X } from 'lucide-react';
import CodeViewer from './CodeViewer';

interface DetailPanelProps {
  node: GraphNode;
  graphData: GraphData;
  fileContent?: string;
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

export default function DetailPanel({
  node,
  graphData,
  fileContent,
  onClose,
  onNavigate,
}: DetailPanelProps) {
  const color = FILE_TYPE_COLORS[node.fileType] || FILE_TYPE_COLORS.unknown;

  // ESC to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Find connected nodes
  const connectedNodes = graphData.edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => {
      const otherId = e.source === node.id ? e.target : e.source;
      return graphData.nodes.find((n) => n.id === otherId);
    })
    .filter(Boolean) as GraphNode[];

  return (
    <div className="fixed right-0 top-0 z-40 flex h-dvh w-[40%] min-w-[360px] max-w-[600px] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate font-[var(--font-mono)] text-sm text-[var(--color-text)]">
            {node.label}
          </span>
          <span
            className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
            style={{ backgroundColor: color + '22', color }}
          >
            {node.fileType}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--color-text)]"
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
          <div className="mt-2 flex gap-4 text-xs text-[var(--color-text-muted)]">
            <span>{node.loc} LOC</span>
            <span>Complexity: {node.complexity}</span>
          </div>
        </div>

        {/* Exports */}
        {node.exports.length > 0 && (
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Exports ({node.exports.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {node.exports.map((exp) => (
                <span
                  key={exp}
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
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Functions ({node.functions.length})
            </h3>
            <div className="space-y-1">
              {node.functions.map((fn) => (
                <div key={`${fn.name}-${fn.line}`} className="flex items-center gap-2">
                  <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-accent)]">
                    {fn.name}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    ({fn.params.join(', ')})
                  </span>
                  {fn.isExported && (
                    <span className="text-[9px] text-green-400">exported</span>
                  )}
                  <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
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
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Imports ({node.imports.length})
            </h3>
            <div className="space-y-0.5">
              {node.imports.map((imp) => (
                <p
                  key={imp}
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
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Connected Files ({connectedNodes.length})
            </h3>
            <div className="space-y-1">
              {connectedNodes.map((cn) => {
                const cnColor = FILE_TYPE_COLORS[cn.fileType] || FILE_TYPE_COLORS.unknown;
                return (
                  <button
                    key={cn.id}
                    onClick={() => onNavigate(cn.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-white/5"
                  >
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: cnColor }}
                    />
                    <span className="truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text)]">
                      {cn.label}
                    </span>
                    <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                      {cn.loc} LOC
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
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Source
            </h3>
            <CodeViewer code={fileContent} filePath={node.filePath} />
          </div>
        )}
      </div>
    </div>
  );
}
