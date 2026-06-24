'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Settings, RotateCcw } from 'lucide-react';
import { EDGE_TYPE_COLORS } from '@/lib/constants';
import type { FileType } from '@/lib/graph/types';
import type { EdgeType } from '@/lib/graph/types';
import { cn } from '@/lib/utils';

const NODE_ITEMS: { key: FileType; label: string }[] = [
  { key: 'component', label: 'Components / Pages' },
  { key: 'route', label: 'Routes / API' },
  { key: 'service', label: 'Services / Logic' },
  { key: 'utility', label: 'Utilities' },
  { key: 'model', label: 'Models / Types' },
  { key: 'test', label: 'Tests' },
  { key: 'config', label: 'Config' },
];

/* Re-export the single source of truth so existing
   `import { DEFAULT_EDGE_COLORS } from '@/components/graph/Legend'` keeps working. */
const DEFAULT_EDGE_COLORS: Record<EdgeType, string> = EDGE_TYPE_COLORS;

const EDGE_ITEMS: { key: EdgeType; label: string; style: string }[] = [
  { key: 'import', label: 'Import', style: 'solid' },
  { key: 'export', label: 'Connected files', style: 'dotted' },
  { key: 'call', label: 'Function call', style: 'dashed' },
];

interface LegendProps {
  nodeColors: Record<FileType, string>;
  onNodeColorChange: (fileType: FileType, color: string) => void;
  edgeColors: Record<EdgeType, string>;
  onEdgeColorChange: (edgeType: EdgeType, color: string) => void;
  onResetColors: () => void;
  visibleEdgeTypes: Set<EdgeType>;
  onToggleEdgeType: (edgeType: EdgeType) => void;
  className?: string;
}

export { DEFAULT_EDGE_COLORS };

export default function Legend({
  nodeColors,
  onNodeColorChange,
  edgeColors,
  onEdgeColorChange,
  onResetColors,
  visibleEdgeTypes,
  onToggleEdgeType,
  className,
}: LegendProps) {
  const [open, setOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<FileType | null>(null);
  const [editingEdgeColor, setEditingEdgeColor] = useState<EdgeType | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const edgeColorInputRef = useRef<HTMLInputElement>(null);

  const handleColorClick = (key: FileType) => {
    setEditingColor(key);
    setTimeout(() => colorInputRef.current?.click(), 50);
  };

  const handleEdgeColorClick = (key: EdgeType) => {
    setEditingEdgeColor(key);
    setTimeout(() => edgeColorInputRef.current?.click(), 50);
  };

  return (
    <div className={cn('fixed top-12 sm:top-16 right-2 sm:right-4 z-20 max-w-[320px]', className)}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Collapse legend' : 'Expand legend'}
        className="glass inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
      >
        <Settings size={13} />
        Legend
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Hidden color picker inputs */}
      <input
        ref={colorInputRef}
        type="color"
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 0, height: 0 }}
        value={editingColor ? nodeColors[editingColor] : '#000000'}
        onChange={(e) => {
          if (editingColor) onNodeColorChange(editingColor, e.target.value);
        }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={edgeColorInputRef}
        type="color"
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 0, height: 0 }}
        value={editingEdgeColor ? edgeColors[editingEdgeColor] : '#000000'}
        onChange={(e) => {
          if (editingEdgeColor) onEdgeColorChange(editingEdgeColor, e.target.value);
        }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Disclosure body — animates height + opacity on open/close. */}
      <div
        className={cn(
          'grid transition-all duration-200 ease-out',
          open ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div
            className="glass overflow-y-auto rounded-xl p-4"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
          >
            {/* Node colors — clickable to change */}
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                  Node Colors
                </h4>
                <button
                  onClick={onResetColors}
                  className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
                  title="Reset to defaults"
                  aria-label="Reset node and edge colors to defaults"
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {NODE_ITEMS.map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <button
                      onClick={() => handleColorClick(item.key)}
                      className="inline-block h-4 w-4 flex-shrink-0 cursor-pointer rounded-full border border-white/20 transition-transform hover:scale-125"
                      style={{
                        backgroundColor: nodeColors[item.key],
                        boxShadow: `0 0 8px ${nodeColors[item.key]}60`,
                      }}
                      title="Click to change color"
                      aria-label={`Change color for ${item.label}`}
                    />
                    <span className="flex-1 text-[11px] text-[var(--color-text)]">{item.label}</span>
                    <span className="font-[var(--font-mono)] text-[9px] text-[var(--color-text-muted)]">
                      {nodeColors[item.key]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[9px] text-[var(--color-text-muted)]">
                Click any circle to change its color
              </p>
            </div>

            {/* Edge toggles */}
            <div className="mb-3 border-t border-[var(--color-border)] pt-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                Connection Lines
              </h4>
              <div className="flex flex-col gap-2">
                {EDGE_ITEMS.map((item) => {
                  const isVisible = visibleEdgeTypes.has(item.key);
                  const color = edgeColors[item.key];
                  return (
                    <div
                      key={item.key}
                      className={cn('flex items-center gap-2 transition-opacity', !isVisible && 'opacity-35')}
                    >
                      <button
                        onClick={() => handleEdgeColorClick(item.key)}
                        className="flex-shrink-0 cursor-pointer transition-transform hover:scale-125"
                        title="Click to change color"
                        aria-label={`Change color for ${item.label}`}
                      >
                        <svg width="28" height="8">
                          <line
                            x1="0"
                            y1="4"
                            x2="28"
                            y2="4"
                            stroke={color}
                            strokeWidth="2.5"
                            strokeDasharray={
                              item.style === 'dashed'
                                ? '6,4'
                                : item.style === 'dotted'
                                  ? '2,3'
                                  : undefined
                            }
                          />
                        </svg>
                      </button>
                      <span className="flex-1 text-[11px] text-[var(--color-text)]">{item.label}</span>
                      <button
                        onClick={() => onToggleEdgeType(item.key)}
                        aria-pressed={isVisible}
                        aria-label={`${isVisible ? 'Hide' : 'Show'} ${item.label} edges`}
                        className={cn(
                          'flex-shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-medium transition',
                          isVisible
                            ? 'bg-white/[0.08] text-[var(--color-text)] hover:bg-white/[0.12]'
                            : 'bg-white/[0.03] text-[var(--color-text-muted)] hover:bg-white/[0.06]',
                        )}
                      >
                        {isVisible ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visual meaning */}
            <div className="border-t border-[var(--color-border)] pt-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                Visual Meaning
              </h4>
              <div className="flex flex-col gap-1 text-[10px] text-[var(--color-text-muted)]">
                <span>Node size = file complexity</span>
                <span>Edge brightness = connection strength</span>
                <span>Clusters = files in same directory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
