'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { FILE_TYPE_COLORS, COLORS } from '@/lib/constants';

const NODE_LEGEND = [
  { label: 'Components / Pages', color: FILE_TYPE_COLORS.component, desc: 'React components, page files' },
  { label: 'Routes / API', color: FILE_TYPE_COLORS.route, desc: 'API routes, endpoint handlers' },
  { label: 'Services / Logic', color: FILE_TYPE_COLORS.service, desc: 'Business logic, helpers' },
  { label: 'Utilities', color: FILE_TYPE_COLORS.utility, desc: 'Shared utility functions' },
  { label: 'Models / Types', color: FILE_TYPE_COLORS.model, desc: 'Data models, type definitions' },
  { label: 'Tests', color: FILE_TYPE_COLORS.test, desc: 'Test files, specs' },
  { label: 'Config', color: FILE_TYPE_COLORS.config, desc: 'Configuration, env, build files' },
];

const EDGE_LEGEND = [
  { label: 'Import', style: 'solid', color: '#60a5fa', desc: 'File A pulls from File B' },
  { label: 'Export', style: 'dotted', color: '#a78bfa', desc: 'File A provides to File B' },
  { label: 'Function call', style: 'dashed', color: '#fbbf24', desc: 'Cross-file function call' },
];

const SIZE_LEGEND = [
  { label: 'Node size', desc: 'Based on file complexity (LOC × functions)' },
  { label: 'Edge brightness', desc: 'Stronger connection = brighter line' },
  { label: 'Clusters', desc: 'Files in the same directory group together' },
];

export default function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed top-16 right-4 z-20" style={{ maxWidth: 320 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.textMuted,
        }}
      >
        <Info size={13} />
        Legend
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div
          className="mt-2 rounded-xl p-4 shadow-2xl"
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {/* Node colors */}
          <div className="mb-3">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
              Node Colors
            </h4>
            <div className="flex flex-col gap-1.5">
              {NODE_LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}60` }}
                  />
                  <span className="text-[11px]" style={{ color: COLORS.text }}>{item.label}</span>
                  <span className="ml-auto text-[10px]" style={{ color: COLORS.textMuted }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edge types */}
          <div className="mb-3 border-t pt-3" style={{ borderColor: COLORS.border }}>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
              Connection Lines
            </h4>
            <div className="flex flex-col gap-2">
              {EDGE_LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <svg width="28" height="8" className="flex-shrink-0">
                    <line
                      x1="0" y1="4" x2="28" y2="4"
                      stroke={item.color}
                      strokeWidth="2"
                      strokeDasharray={
                        item.style === 'dashed' ? '6,4' :
                        item.style === 'dotted' ? '2,3' :
                        undefined
                      }
                    />
                  </svg>
                  <span className="text-[11px]" style={{ color: COLORS.text }}>{item.label}</span>
                  <span className="ml-auto text-[10px]" style={{ color: COLORS.textMuted }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Size meaning */}
          <div className="border-t pt-3" style={{ borderColor: COLORS.border }}>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
              Visual Meaning
            </h4>
            <div className="flex flex-col gap-1">
              {SIZE_LEGEND.map((item) => (
                <div key={item.label} className="flex items-start gap-1.5">
                  <span className="mt-0.5 text-[10px] font-medium" style={{ color: COLORS.accent }}>•</span>
                  <div>
                    <span className="text-[11px] font-medium" style={{ color: COLORS.text }}>{item.label}</span>
                    <span className="ml-1 text-[10px]" style={{ color: COLORS.textMuted }}>— {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
