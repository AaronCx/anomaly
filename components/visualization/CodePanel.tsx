'use client'

import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_DIM, BG_COLOR } from '@/lib/color-schemes'

interface CodePanelProps {
  filePath: string | null
  lineNumber: number | null
  isOpen: boolean
  onClose: () => void
  sourceCode?: string
}

export default function CodePanel({
  filePath,
  lineNumber,
  isOpen,
  onClose,
  sourceCode,
}: CodePanelProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  useEffect(() => {
    if (!sourceCode) {
      setHighlightedHtml('')
      return
    }

    let cancelled = false
    setIsLoading(true)

    import('shiki').then(async ({ createHighlighter }) => {
      if (cancelled) return

      const lang = getLangFromPath(filePath || '')
      const highlighter = await createHighlighter({
        themes: ['github-dark-default'],
        langs: [lang],
      })

      if (cancelled) return

      const html = highlighter.codeToHtml(sourceCode, {
        lang,
        theme: 'github-dark-default',
      })

      setHighlightedHtml(html)
      setIsLoading(false)
      highlighter.dispose()
    }).catch(() => {
      if (!cancelled) {
        setHighlightedHtml(`<pre>${escapeHtml(sourceCode)}</pre>`)
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [sourceCode, filePath])

  useEffect(() => {
    if (isOpen && lineNumber && highlightedHtml) {
      requestAnimationFrame(() => {
        const lineEl = document.querySelector(`[data-line="${lineNumber}"]`)
        lineEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }, [isOpen, lineNumber, highlightedHtml])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: `${BG_COLOR}80` }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-50 flex h-full flex-col shadow-2xl transition-transform duration-300"
        style={{
          width: 'min(640px, 50vw)',
          background: CARD_BG,
          borderLeft: `1px solid ${CARD_BORDER}`,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${CARD_BORDER}` }}
        >
          <div className="flex flex-col">
            <span
              className="font-mono text-xs font-bold"
              style={{ color: TEXT_PRIMARY, fontFamily: 'var(--font-jetbrains)' }}
            >
              {filePath || 'No file selected'}
            </span>
            {lineNumber && (
              <span
                className="font-mono text-[10px]"
                style={{ color: TEXT_DIM, fontFamily: 'var(--font-jetbrains)' }}
              >
                Line {lineNumber}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-white/5"
            style={{ color: TEXT_DIM }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center gap-2" style={{ color: TEXT_DIM }}>
              <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              <span className="text-xs">Loading syntax highlight...</span>
            </div>
          ) : highlightedHtml ? (
            <div
              className="code-panel-content text-xs leading-relaxed [&_pre]:!bg-transparent [&_code]:font-mono"
              style={{ fontFamily: 'var(--font-jetbrains)' }}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <div className="text-xs" style={{ color: TEXT_DIM }}>
              No source code available
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function getLangFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    java: 'java',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    css: 'css',
    html: 'html',
    md: 'markdown',
  }
  return langMap[ext || ''] || 'typescript'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
