'use client';

import { useEffect, useState } from 'react';
import type { Highlighter } from 'shiki';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeViewerProps {
  code: string;
  filePath: string;
  className?: string;
}

const THEME = 'github-dark-default';

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  java: 'java',
  json: 'json',
  css: 'css',
  html: 'html',
  md: 'markdown',
};

function langForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return LANG_MAP[ext] ?? 'text';
}

/* Cache the Shiki highlighter at module scope so it is created once for the
   whole app rather than re-instantiated (and leaked) on every mount. */
let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    const { createHighlighter } = await import('shiki');
    highlighterPromise = createHighlighter({
      themes: [THEME],
      langs: [],
    });
  }
  return highlighterPromise;
}

async function highlightCode(code: string, filePath: string): Promise<string> {
  const highlighter = await getHighlighter();
  const lang = langForPath(filePath);

  // Lazily load the grammar only the first time we see this language.
  if (lang !== 'text' && !highlighter.getLoadedLanguages().includes(lang)) {
    await highlighter.loadLanguage(lang as Parameters<Highlighter['loadLanguage']>[0]);
  }

  return highlighter.codeToHtml(code, {
    lang: highlighter.getLoadedLanguages().includes(lang) ? lang : 'text',
    theme: THEME,
  });
}

export default function CodeViewer({ code, filePath, className }: CodeViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Reset to the loading state before kicking off the async highlight.
    /* eslint-disable react-hooks/set-state-in-effect */
    setHtml(null);
    setError(false);
    /* eslint-enable react-hooks/set-state-in-effect */

    highlightCode(code, filePath)
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [code, filePath]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const fileName = filePath.split('/').pop() ?? filePath;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]',
        className,
      )}
    >
      {/* Header: file name + copy */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-1.5">
        <span className="truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
          {fileName}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="inline-flex items-center justify-center rounded-lg p-1 text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95"
        >
          {copied ? (
            <Check size={13} className="text-[var(--color-success)]" />
          ) : (
            <Copy size={13} />
          )}
        </button>
      </div>

      {/* Body */}
      {error ? (
        <pre className="max-h-[400px] overflow-auto p-3 font-[var(--font-mono)] text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          {code}
        </pre>
      ) : !html ? (
        /* Shimmer skeleton sized like the code block */
        <div
          aria-label="Loading code"
          aria-busy="true"
          className="animate-pulse-soft space-y-2 p-3"
        >
          {[92, 64, 80, 48, 72, 56, 84].map((w, i) => (
            <div
              key={i}
              className="h-2.5 rounded-full bg-[var(--color-surface-2)]"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ) : (
        <div
          role="region"
          aria-label={`Source code for ${fileName}`}
          className="animate-fade-in max-h-[400px] overflow-auto text-[11px] leading-relaxed [&_pre]:!bg-[var(--color-bg)] [&_pre]:p-3"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
