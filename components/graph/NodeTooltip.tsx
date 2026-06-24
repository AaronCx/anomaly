'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GraphNode } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface NodeTooltipProps {
  node: GraphNode;
  x: number;
  y: number;
  className?: string;
}

const OFFSET = 14;

export default function NodeTooltip({ node, x, y, className }: NodeTooltipProps) {
  const color = FILE_TYPE_COLORS[node.fileType] || FILE_TYPE_COLORS.unknown;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Measure the tooltip so we can keep it inside the viewport.
  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, [node]);

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Flip to the other side of the cursor when near the right / bottom edge.
  const flipX = viewport.w > 0 && x + OFFSET + size.width > viewport.w;
  const flipY = viewport.h > 0 && y + OFFSET + size.height > viewport.h;
  const left = flipX ? x - OFFSET - size.width : x + OFFSET;
  const top = flipY ? y - OFFSET - size.height : y + OFFSET;

  return (
    <div
      ref={ref}
      className={cn(
        'glass animate-fade-in pointer-events-none fixed z-50 max-w-xs rounded-xl px-3 py-2',
        className,
      )}
      style={{
        left: Math.max(4, left),
        top: Math.max(4, top),
        animationDuration: '0.12s',
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
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
        <span>{node.loc} LOC</span>
        <span>{node.exports.length} exports</span>
        <span>{node.functions.length} functions</span>
      </div>
      <span
        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
        style={{
          backgroundColor: color + '22',
          color,
          boxShadow: `inset 0 0 0 1px ${color}33`,
        }}
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
