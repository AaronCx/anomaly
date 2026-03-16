'use client';

import { useEffect, useState } from 'react';

interface CodeViewerProps {
  code: string;
  filePath: string;
  highlightLines?: number[];
}

async function highlightCode(code: string, filePath: string): Promise<string> {
  const { createHighlighter } = await import('shiki');

  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const langMap: Record<string, string> = {
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
  const lang = langMap[ext] ?? 'text';

  const highlighter = await createHighlighter({
    themes: ['github-dark-default'],
    langs: [lang],
  });

  return highlighter.codeToHtml(code, {
    lang,
    theme: 'github-dark-default',
  });
}

export default function CodeViewer({ code, filePath, highlightLines }: CodeViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

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

  if (error) {
    return (
      <pre className="max-h-[400px] overflow-auto rounded-lg bg-black/30 p-3 font-[var(--font-mono)] text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        {code}
      </pre>
    );
  }

  if (!html) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-[var(--color-text-muted)]">
        Loading syntax highlighting...
      </div>
    );
  }

  return (
    <div
      className="max-h-[400px] overflow-auto rounded-lg text-[11px] leading-relaxed [&_pre]:!bg-black/30 [&_pre]:p-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
