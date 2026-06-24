'use client';

import { ZoomIn, ZoomOut, Maximize, Map, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  className?: string;
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
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center rounded-lg p-2 transition active:scale-95',
        active
          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)]'
          : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text)]',
      )}
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
  className,
}: GraphControlsProps) {
  return (
    <div
      className={cn(
        'fixed bottom-2 sm:bottom-4 left-2 sm:left-4 z-30 flex flex-col items-start gap-1 sm:gap-2 animate-fade-in-up',
        className,
      )}
    >
      {/* Controls */}
      <div className="glass flex items-center gap-0.5 rounded-xl p-1">
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
      <div className="glass rounded-lg px-2.5 py-1">
        <span className="font-[var(--font-mono)] text-[10px] text-[var(--color-text-muted)]">
          {nodeCount} nodes &middot; {edgeCount} edges
        </span>
      </div>
    </div>
  );
}
