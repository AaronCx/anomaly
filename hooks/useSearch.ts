import { useState, useCallback, useEffect, useRef } from 'react';

export function useSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const selectResult = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId);
    setIsOpen(false);

    // Clear any pending highlight reset before scheduling a new one
    if (highlightTimer.current) clearTimeout(highlightTimer.current);

    // Clear highlight after animation
    highlightTimer.current = setTimeout(() => {
      setHighlightedNodeId(null);
      highlightTimer.current = null;
    }, 3000);
  }, []);

  // Clear any pending highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
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
