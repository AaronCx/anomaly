'use client';

import type { GraphNode } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';

interface NodeTooltipProps {
  node: GraphNode;
  x: number;
  y: number;
}

export default function NodeTooltip({ node, x, y }: NodeTooltipProps) {
  const color = FILE_TYPE_COLORS[node.fileType] || FILE_TYPE_COLORS.unknown;

  return (
    <div
      className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-2xl"
      style={{
        left: x + 14,
        top: y + 14,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate font-[var(--font-mono)] text-xs text-[var(--color-text)]">
          {node.label}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-text-muted)]">
        <span>{node.loc} LOC</span>
        <span>{node.exports.length} exports</span>
        <span>{node.functions.length} functions</span>
      </div>
      <span
        className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
        style={{ backgroundColor: color + '22', color }}
      >
        {node.fileType}
      </span>
      {node.annotation && (
        <p className="mt-1 text-[10px] leading-tight text-[var(--color-text-muted)]">
          {node.annotation}
        </p>
      )}
    </div>
  );
}
