'use client';

import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Settings, RotateCcw } from 'lucide-react';
import { FILE_TYPE_COLORS, COLORS } from '@/lib/constants';
import type { FileType } from '@/lib/graph/types';
import type { EdgeType } from '@/lib/graph/types';

const NODE_ITEMS: { key: FileType; label: string }[] = [
  { key: 'component', label: 'Components / Pages' },
  { key: 'route', label: 'Routes / API' },
  { key: 'service', label: 'Services / Logic' },
  { key: 'utility', label: 'Utilities' },
  { key: 'model', label: 'Models / Types' },
  { key: 'test', label: 'Tests' },
  { key: 'config', label: 'Config' },
];

const EDGE_ITEMS: { key: EdgeType; label: string; style: string; defaultColor: string }[] = [
  { key: 'import', label: 'Import', style: 'solid', defaultColor: '#60a5fa' },
  { key: 'export', label: 'Export', style: 'dotted', defaultColor: '#a78bfa' },
  { key: 'call', label: 'Function call', style: 'dashed', defaultColor: '#fbbf24' },
];

interface LegendProps {
  nodeColors: Record<FileType, string>;
  onNodeColorChange: (fileType: FileType, color: string) => void;
  onResetColors: () => void;
  visibleEdgeTypes: Set<EdgeType>;
  onToggleEdgeType: (edgeType: EdgeType) => void;
}

export default function Legend({
  nodeColors,
  onNodeColorChange,
  onResetColors,
  visibleEdgeTypes,
  onToggleEdgeType,
}: LegendProps) {
  const [open, setOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<FileType | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleColorClick = (key: FileType) => {
    setEditingColor(key);
    // Delay to let the hidden input render
    setTimeout(() => colorInputRef.current?.click(), 50);
  };

  return (
    <div className="fixed top-16 right-4 z-20" style={{ maxWidth: 340 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.textMuted,
        }}
      >
        <Settings size={13} />
        Legend
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Hidden color picker input */}
      <input
        ref={colorInputRef}
        type="color"
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 0, height: 0 }}
        value={editingColor ? nodeColors[editingColor] : '#000000'}
        onChange={(e) => {
          if (editingColor) onNodeColorChange(editingColor, e.target.value);
        }}
      />

      {open && (
        <div
          className="mt-2 rounded-xl p-4 shadow-2xl overflow-y-auto"
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          {/* Node colors — clickable to change */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
                Node Colors
              </h4>
              <button
                onClick={onResetColors}
                className="flex items-center gap-1 text-[10px] transition-colors hover:opacity-80"
                style={{ color: COLORS.textMuted }}
                title="Reset to defaults"
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
                    className="inline-block h-4 w-4 flex-shrink-0 rounded-full cursor-pointer transition-transform hover:scale-125 border border-white/20"
                    style={{
                      backgroundColor: nodeColors[item.key],
                      boxShadow: `0 0 8px ${nodeColors[item.key]}60`,
                    }}
                    title="Click to change color"
                  />
                  <span className="text-[11px] flex-1" style={{ color: COLORS.text }}>{item.label}</span>
                  <span className="text-[9px] font-mono" style={{ color: COLORS.textMuted }}>
                    {nodeColors[item.key]}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px]" style={{ color: COLORS.textMuted }}>
              Click any circle to change its color
            </p>
          </div>

          {/* Edge toggles */}
          <div className="mb-3 border-t pt-3" style={{ borderColor: COLORS.border }}>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
              Connection Lines
            </h4>
            <div className="flex flex-col gap-2">
              {EDGE_ITEMS.map((item) => {
                const isVisible = visibleEdgeTypes.has(item.key);
                return (
                  <button
                    key={item.key}
                    onClick={() => onToggleEdgeType(item.key)}
                    className="flex items-center gap-2 w-full text-left transition-opacity"
                    style={{ opacity: isVisible ? 1 : 0.35 }}
                  >
                    <svg width="28" height="8" className="flex-shrink-0">
                      <line
                        x1="0" y1="4" x2="28" y2="4"
                        stroke={item.defaultColor}
                        strokeWidth="2"
                        strokeDasharray={
                          item.style === 'dashed' ? '6,4' :
                          item.style === 'dotted' ? '2,3' :
                          undefined
                        }
                      />
                    </svg>
                    <span className="text-[11px]" style={{ color: COLORS.text }}>{item.label}</span>
                    <span
                      className="ml-auto text-[9px] font-medium rounded px-1.5 py-0.5"
                      style={{
                        background: isVisible ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        color: isVisible ? COLORS.text : COLORS.textMuted,
                      }}
                    >
                      {isVisible ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual meaning */}
          <div className="border-t pt-3" style={{ borderColor: COLORS.border }}>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
              Visual Meaning
            </h4>
            <div className="flex flex-col gap-1 text-[10px]" style={{ color: COLORS.textMuted }}>
              <span>Node size = file complexity</span>
              <span>Edge brightness = connection strength</span>
              <span>Clusters = files in same directory</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
