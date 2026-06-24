'use client';

import type { FileType } from '@/lib/graph/types';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  activeFilters: Set<FileType>;
  onToggle: (type: FileType) => void;
  onReset: () => void;
  className?: string;
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

export default function FilterBar({ activeFilters, onToggle, onReset, className }: FilterBarProps) {
  const allActive = activeFilters.size === 0;

  return (
    <div
      className={cn(
        'fixed left-1/2 top-3 z-30 -translate-x-1/2 max-w-[calc(100vw-100px)] sm:max-w-none animate-fade-in',
        className,
      )}
    >
      {/* Glass pill bar wraps a scroll container that fades its content at the
          right edge to hint at overflow on small screens (border/shadow stay intact). */}
      <div className="glass overflow-hidden rounded-full">
        <div
          className="overflow-x-auto scrollbar-hide"
          style={{
            WebkitMaskImage:
              'linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)',
            maskImage:
              'linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)',
          }}
        >
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 whitespace-nowrap">
            <button
              onClick={onReset}
              className={cn(
                'flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                allActive
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)]'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text)]',
              )}
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
                  aria-pressed={isActive}
                  className={cn(
                    'flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                    !isActive &&
                      'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text)]',
                  )}
                  style={
                    isActive
                      ? {
                          backgroundColor: color + '22',
                          color,
                          boxShadow: `inset 0 0 0 1px ${color}40`,
                        }
                      : undefined
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
