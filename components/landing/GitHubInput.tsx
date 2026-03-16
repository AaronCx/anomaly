'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, ArrowRight } from 'lucide-react';
import { parseRepoUrl, cn } from '@/lib/utils';

export default function GitHubInput() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = parseRepoUrl(url);
    if (!parsed) {
      setError('Enter a valid GitHub URL or owner/repo');
      return;
    }

    router.push(`/graph?repo=${parsed.owner}/${parsed.repo}`);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-border)]">
        <Github className="h-6 w-6 text-[var(--color-text-muted)]" />
      </div>

      <div className="text-center">
        <p className="font-medium">Paste a GitHub URL</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Public repos only (for now)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            placeholder="owner/repo or full URL"
            className={cn(
              'flex-1 rounded-lg border bg-[var(--color-bg)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--color-text-muted)]',
              error
                ? 'border-red-500/60'
                : 'border-[var(--color-border)] focus:border-[var(--color-accent)]',
            )}
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90"
          >
            Analyze
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </form>
    </div>
  );
}
