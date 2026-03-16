import { useState, useCallback } from 'react';
import type { FileType } from '@/lib/graph/types';

export function useGraphFilters() {
  const [activeFilters, setActiveFilters] = useState<Set<FileType>>(new Set());

  const toggleFilter = useCallback((type: FileType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setActiveFilters(new Set());
  }, []);

  return { activeFilters, toggleFilter, resetFilters };
}
