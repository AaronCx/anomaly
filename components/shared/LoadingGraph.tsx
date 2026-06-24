'use client';

import { useEffect, useState } from 'react';

interface LoadingGraphProps {
  fileCount?: number;
  message?: string;
}

const NODES = [
  { x: 12, y: 8, r: 2.5, delay: 0 },
  { x: 48, y: 4, r: 3, delay: 150 },
  { x: 80, y: 16, r: 2, delay: 300 },
  { x: 28, y: 44, r: 3.5, delay: 450 },
  { x: 64, y: 40, r: 4, delay: 100 },
  { x: 44, y: 72, r: 2.5, delay: 250 },
  { x: 16, y: 68, r: 2, delay: 350 },
  { x: 76, y: 64, r: 3, delay: 200 },
];

const LINES: Array<[number, number, number, number, number]> = [
  // x1, y1, x2, y2, delay(ms)
  [12, 8, 48, 4, 0],
  [48, 4, 80, 16, 200],
  [12, 8, 28, 44, 350],
  [48, 4, 64, 40, 120],
  [28, 44, 64, 40, 260],
  [28, 44, 44, 72, 400],
  [64, 40, 76, 64, 180],
  [44, 72, 16, 68, 320],
];

export default function LoadingGraph({ fileCount, message }: LoadingGraphProps) {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((c) => (c + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <div className="app-backdrop flex h-dvh w-full flex-col items-center justify-center gap-6">
      {/* Refined animated node graph */}
      <div className="animate-float relative h-28 w-28">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 96 80">
          {/* Soft connecting lines */}
          {LINES.map(([x1, y1, x2, y2, delay], i) => (
            <line
              key={`l-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--color-accent)"
              strokeOpacity={0.18}
              strokeWidth={0.75}
              strokeLinecap="round"
              className="animate-pulse-soft"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}

          {/* Nodes with a soft luminous glow */}
          {NODES.map((n, i) => (
            <g key={`n-${i}`}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r * 2.4}
                fill="var(--color-accent)"
                opacity={0.12}
                style={{
                  transformOrigin: `${n.x}px ${n.y}px`,
                  animation: `pulse-node 1.8s var(--ease-out) ${n.delay}ms infinite`,
                }}
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill="var(--color-accent-bright)"
                style={{
                  transformOrigin: `${n.x}px ${n.y}px`,
                  animation: `pulse-node 1.8s var(--ease-out) ${n.delay}ms infinite`,
                }}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="font-[var(--font-mono)] text-sm text-[var(--color-text-muted)]">
          {message ??
            (fileCount ? `Parsing ${fileCount} files${dots}` : `Loading${dots}`)}
        </p>
        {/* Staged shimmer progress bar */}
        <div className="h-0.5 w-40 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div
            className="h-full w-1/2 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s linear infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}
