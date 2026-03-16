'use client';

import Link from 'next/link';
import { DEMOS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function DemoCards() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-[var(--color-text-muted)]">Or explore:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {DEMOS.map((demo) => (
          <Link
            key={demo.name}
            href={`/graph?demo=${demo.name}`}
            className={cn(
              'rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 text-sm transition-all duration-200',
              'hover:border-[var(--color-accent)]/40 hover:shadow-[0_0_20px_rgba(96,165,250,0.1)]',
            )}
          >
            {demo.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
