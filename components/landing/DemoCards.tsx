'use client';

import Link from 'next/link';
import { DEMOS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function DemoCards() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
        Or explore
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {DEMOS.map((demo) => (
          <Link
            key={demo.name}
            href={`/graph?demo=${demo.name}`}
            className={cn(
              'rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 font-[var(--font-mono)] text-[13px] font-medium text-[var(--color-text-muted)] transition duration-200 ease-out',
              'hover:-translate-y-0.5 hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent-bright)] hover:shadow-[var(--shadow-glow)]',
              'active:translate-y-0 active:scale-[0.97]',
            )}
          >
            {demo.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
