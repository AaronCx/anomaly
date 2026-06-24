'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { GraphNode } from '@/lib/graph/types';
import { COLORS, FILE_TYPE_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface MinimapProps {
  nodes: GraphNode[];
  viewportRect: { x: number; y: number; width: number; height: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  onNavigate: (x: number, y: number) => void;
  visible: boolean;
  className?: string;
}

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const PADDING = 10;

/** Hex (#rrggbb) → rgba() string at the given alpha. Falls back to the
 *  input untouched if it's already a non-hex color (e.g. rgba()). */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Minimap({
  nodes,
  viewportRect,
  bounds,
  onNavigate,
  visible,
  className,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Background — surface token at near-opaque alpha so dots read clearly.
    ctx.fillStyle = withAlpha(COLORS.surface, 0.92);
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    if (nodes.length === 0) return;

    const bw = bounds.maxX - bounds.minX || 1;
    const bh = bounds.maxY - bounds.minY || 1;
    const scaleX = (MINIMAP_WIDTH - PADDING * 2) / bw;
    const scaleY = (MINIMAP_HEIGHT - PADDING * 2) / bh;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = PADDING + ((MINIMAP_WIDTH - PADDING * 2) - bw * scale) / 2;
    const offsetY = PADDING + ((MINIMAP_HEIGHT - PADDING * 2) - bh * scale) / 2;

    // Draw nodes as dots with a faint glow, colored by file type.
    for (const node of nodes) {
      const nx = (node.x! - bounds.minX) * scale + offsetX;
      const ny = (node.y! - bounds.minY) * scale + offsetY;
      const color = FILE_TYPE_COLORS[node.fileType] || FILE_TYPE_COLORS.unknown;

      ctx.beginPath();
      ctx.arc(nx, ny, 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Draw the viewport as a translucent accent "lens".
    const vx = (viewportRect.x - bounds.minX) * scale + offsetX;
    const vy = (viewportRect.y - bounds.minY) * scale + offsetY;
    const vw = viewportRect.width * scale;
    const vh = viewportRect.height * scale;

    ctx.fillStyle = withAlpha(COLORS.accent, 0.12);
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = withAlpha(COLORS.accent, 0.85);
    ctx.lineWidth = 1.25;
    ctx.strokeRect(vx, vy, vw, vh);
  }, [nodes, viewportRect, bounds]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const bw = bounds.maxX - bounds.minX || 1;
      const bh = bounds.maxY - bounds.minY || 1;
      const scaleX = (MINIMAP_WIDTH - PADDING * 2) / bw;
      const scaleY = (MINIMAP_HEIGHT - PADDING * 2) / bh;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = PADDING + ((MINIMAP_WIDTH - PADDING * 2) - bw * scale) / 2;
      const offsetY = PADDING + ((MINIMAP_HEIGHT - PADDING * 2) - bh * scale) / 2;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const worldX = (mx - offsetX) / scale + bounds.minX;
      const worldY = (my - offsetY) / scale + bounds.minY;

      onNavigate(worldX, worldY);
    },
    [bounds, onNavigate],
  );

  if (!visible) return null;

  return (
    <div
      className={cn(
        'glass animate-fade-in fixed bottom-2 right-2 z-30 hidden overflow-hidden rounded-xl p-1 sm:bottom-4 sm:right-4 sm:block',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        aria-label="Graph minimap — click to navigate the view"
        role="img"
        className="block cursor-crosshair rounded-lg"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      />
    </div>
  );
}
