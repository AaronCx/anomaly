'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'
import { CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_DIM, ACCENT } from '@/lib/color-schemes'

export interface SearchItem {
  id: string
  label: string
  sublabel?: string
  type: 'file' | 'function'
}

interface SearchBarProps {
  items: SearchItem[]
  onSelect: (item: SearchItem) => void
  placeholder?: string
}

export default function SearchBar({
  items,
  onSelect,
  placeholder = 'Search files and functions...',
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.length > 0
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.sublabel?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20)
    : []

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex])
      setQuery('')
      setIsOpen(false)
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
        style={{
          background: CARD_BG,
          border: `1px solid ${isOpen ? ACCENT : CARD_BORDER}`,
        }}
      >
        <Search size={14} style={{ color: TEXT_DIM }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setSelectedIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200)
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
          style={{ color: TEXT_PRIMARY, fontFamily: 'var(--font-jetbrains)' }}
        />
        <kbd
          className="hidden rounded px-1.5 py-0.5 text-[10px] sm:inline-block"
          style={{ background: `${CARD_BORDER}`, color: TEXT_DIM }}
        >
          {'\u2318'}K
        </kbd>
      </div>

      {isOpen && filtered.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg shadow-lg"
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
          }}
        >
          {filtered.map((item, i) => (
            <button
              key={item.id}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors"
              style={{
                background: i === selectedIndex ? `${ACCENT}15` : 'transparent',
                color: TEXT_PRIMARY,
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(item)
                setQuery('')
                setIsOpen(false)
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span
                className="rounded px-1 py-0.5 text-[9px] font-bold uppercase"
                style={{
                  background: item.type === 'file' ? '#3b82f620' : '#f59e0b20',
                  color: item.type === 'file' ? '#3b82f6' : '#f59e0b',
                }}
              >
                {item.type === 'file' ? 'FILE' : 'FN'}
              </span>
              <div className="flex-1 truncate">
                <span className="font-mono" style={{ fontFamily: 'var(--font-jetbrains)' }}>
                  {item.label}
                </span>
                {item.sublabel && (
                  <span className="ml-2 opacity-40">{item.sublabel}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
