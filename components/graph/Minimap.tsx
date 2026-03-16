'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { GraphNode } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';

interface MinimapProps {
  nodes: GraphNode[];
  viewportRect: { x: number; y: number; width: number; height: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  onNavigate: (x: number, y: number) => void;
  visible: boolean;
}

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;

export default function Minimap({ nodes, viewportRect, bounds, onNavigate, visible }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = 'rgba(11, 11, 15, 0.85)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    if (nodes.length === 0) return;

    const bw = bounds.maxX - bounds.minX || 1;
    const bh = bounds.maxY - bounds.minY || 1;
    const padding = 10;
    const scaleX = (MINIMAP_WIDTH - padding * 2) / bw;
    const scaleY = (MINIMAP_HEIGHT - padding * 2) / bh;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = padding + ((MINIMAP_WIDTH - padding * 2) - bw * scale) / 2;
    const offsetY = padding + ((MINIMAP_HEIGHT - padding * 2) - bh * scale) / 2;

    // Draw nodes as dots
    for (const node of nodes) {
      const nx = (node.x! - bounds.minX) * scale + offsetX;
      const ny = (node.y! - bounds.minY) * scale + offsetY;
      const color = FILE_TYPE_COLORS[node.fileType] || FILE_TYPE_COLORS.unknown;

      ctx.beginPath();
      ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Draw viewport rectangle
    const vx = (viewportRect.x - bounds.minX) * scale + offsetX;
    const vy = (viewportRect.y - bounds.minY) * scale + offsetY;
    const vw = viewportRect.width * scale;
    const vh = viewportRect.height * scale;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
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
      const padding = 10;
      const scaleX = (MINIMAP_WIDTH - padding * 2) / bw;
      const scaleY = (MINIMAP_HEIGHT - padding * 2) / bh;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = padding + ((MINIMAP_WIDTH - padding * 2) - bw * scale) / 2;
      const offsetY = padding + ((MINIMAP_HEIGHT - padding * 2) - bh * scale) / 2;

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
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-30 cursor-crosshair rounded-lg"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    />
  );
}
