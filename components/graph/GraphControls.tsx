'use client';

import { ZoomIn, ZoomOut, Maximize, Map, Type } from 'lucide-react';

interface GraphControlsProps {
  nodeCount: number;
  edgeCount: number;
  showMinimap: boolean;
  showLabels: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleMinimap: () => void;
  onToggleLabels: () => void;
}

function ControlButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg p-2 transition-colors ${
        active
          ? 'bg-white/10 text-[var(--color-text)]'
          : 'text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text)]'
      }`}
    >
      {children}
    </button>
  );
}

export default function GraphControls({
  nodeCount,
  edgeCount,
  showMinimap,
  showLabels,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleMinimap,
  onToggleLabels,
}: GraphControlsProps) {
  return (
    <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2">
      {/* Controls */}
      <div className="flex items-center gap-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-1 backdrop-blur-md">
        <ControlButton onClick={onZoomIn} title="Zoom in">
          <ZoomIn size={16} />
        </ControlButton>
        <ControlButton onClick={onZoomOut} title="Zoom out">
          <ZoomOut size={16} />
        </ControlButton>
        <div className="mx-0.5 h-4 w-px bg-[var(--color-border)]" />
        <ControlButton onClick={onFitView} title="Fit to view">
          <Maximize size={16} />
        </ControlButton>
        <ControlButton onClick={onToggleMinimap} active={showMinimap} title="Toggle minimap">
          <Map size={16} />
        </ControlButton>
        <ControlButton onClick={onToggleLabels} active={showLabels} title="Toggle labels">
          <Type size={16} />
        </ControlButton>
      </div>

      {/* Stats */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-2.5 py-1 backdrop-blur-md">
        <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
          {nodeCount} nodes &middot; {edgeCount} edges
        </span>
      </div>
    </div>
  );
}
