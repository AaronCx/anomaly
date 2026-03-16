import { useState, useCallback, useEffect } from 'react';

export function useSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const selectResult = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId);
    setIsOpen(false);

    // Clear highlight after animation
    const timer = setTimeout(() => setHighlightedNodeId(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return {
    isOpen,
    open,
    close,
    highlightedNodeId,
    selectResult,
  };
}
