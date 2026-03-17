'use client';

import type { FileType } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';

interface FilterBarProps {
  activeFilters: Set<FileType>;
  onToggle: (type: FileType) => void;
  onReset: () => void;
}

const FILTER_TYPES: { type: FileType; label: string }[] = [
  { type: 'component', label: 'Components' },
  { type: 'route', label: 'Routes' },
  { type: 'service', label: 'Services' },
  { type: 'utility', label: 'Utils' },
  { type: 'model', label: 'Models' },
  { type: 'test', label: 'Tests' },
  { type: 'config', label: 'Config' },
];

export default function FilterBar({ activeFilters, onToggle, onReset }: FilterBarProps) {
  const allActive = activeFilters.size === 0;

  return (
    <div className="fixed left-1/2 top-3 z-30 -translate-x-1/2 max-w-[calc(100vw-100px)] sm:max-w-none overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-2 sm:px-3 py-1 sm:py-1.5 backdrop-blur-md whitespace-nowrap">
        <button
          onClick={onReset}
          className={`rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium transition-all flex-shrink-0 ${
            allActive
              ? 'bg-white/10 text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          All
        </button>
        {FILTER_TYPES.map(({ type, label }) => {
          const color = FILE_TYPE_COLORS[type];
          const isActive = activeFilters.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggle(type)}
              className={`rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium transition-all flex-shrink-0 ${
                isActive
                  ? 'text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              style={
                isActive
                  ? { backgroundColor: color + '33', color }
                  : undefined
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
