'use client';

import { useEffect, useState } from 'react';

interface LoadingGraphProps {
  fileCount?: number;
  message?: string;
}

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
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-[var(--color-bg)]">
      {/* Pulsing graph dots */}
      <div className="relative h-24 w-24">
        {[
          { x: 12, y: 8, delay: 0 },
          { x: 48, y: 4, delay: 150 },
          { x: 80, y: 16, delay: 300 },
          { x: 28, y: 44, delay: 450 },
          { x: 64, y: 40, delay: 100 },
          { x: 44, y: 72, delay: 250 },
          { x: 16, y: 68, delay: 350 },
          { x: 76, y: 64, delay: 200 },
        ].map((dot, i) => (
          <div
            key={i}
            className="absolute h-2 w-2 rounded-full bg-[var(--color-accent)]"
            style={{
              left: dot.x,
              top: dot.y,
              animation: `pulse-node 1.6s ease-in-out ${dot.delay}ms infinite`,
            }}
          />
        ))}

        {/* Connecting lines */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 96 80">
          {[
            [16, 12, 52, 8],
            [52, 8, 84, 20],
            [16, 12, 32, 48],
            [52, 8, 68, 44],
            [32, 48, 68, 44],
            [32, 48, 48, 76],
            [68, 44, 80, 68],
            [48, 76, 20, 72],
          ].map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(96, 165, 250, 0.15)"
              strokeWidth={1}
              className="animate-pulse"
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="font-[var(--font-mono)] text-sm text-[var(--color-text-muted)]">
          {message ??
            (fileCount
              ? `Parsing ${fileCount} files${dots}`
              : `Loading${dots}`)}
        </p>
      </div>

      <style jsx>{`
        @keyframes pulse-node {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
