'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, ArrowRight, Loader2 } from 'lucide-react';
import { parseRepoUrl, cn } from '@/lib/utils';

interface GitHubInputProps {
  className?: string;
}

export default function GitHubInput({ className }: GitHubInputProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = parseRepoUrl(url);
    if (!parsed) {
      setError('Enter a valid GitHub URL or owner/repo');
      return;
    }

    setPending(true);
    router.push(`/graph?repo=${parsed.owner}/${parsed.repo}`);
  };

  return (
    <div
      className={cn(
        'glass group flex flex-col items-center justify-center gap-4 rounded-xl p-8 transition-all duration-200 ease-out focus-within:border-[var(--color-accent)]/60',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-surface-2)] transition-colors duration-200">
        <Github className="h-6 w-6 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text)]" />
      </div>

      <div className="text-center">
        <p className="font-medium text-[var(--color-text)]">Paste a GitHub URL</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Public repos only (for now)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            aria-label="GitHub repository URL or owner/repo"
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            placeholder="owner/repo or full URL"
            className={cn(
              'flex-1 rounded-lg border bg-[var(--color-bg)] px-3 py-2 font-[var(--font-mono)] text-sm outline-none transition placeholder:text-[var(--color-text-faint)]',
              error
                ? 'border-[var(--color-danger)]/60 focus:border-[var(--color-danger)] focus:ring-2 focus:ring-[var(--color-danger)]/25'
                : 'border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25',
            )}
          />
          <button
            type="submit"
            disabled={pending}
            className="group/btn flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg)] transition hover:bg-[var(--color-accent-bright)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {pending ? (
              <>
                Loading
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </>
            ) : (
              <>
                Analyze
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
