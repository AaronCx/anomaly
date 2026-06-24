export default function HeroSection() {
  return (
    <div className="animate-fade-in-up flex flex-col items-center gap-5 text-center">
      <div className="flex items-center gap-3">
        {/* Glowing node glyph */}
        <span
          className="animate-pulse-soft inline-block h-3 w-3 shrink-0 rounded-full bg-[var(--color-accent)]"
          style={{ boxShadow: '0 0 16px 2px rgba(106, 168, 255, 0.6)' }}
          aria-hidden
        />
        <h1
          className="text-gradient font-[var(--font-mono)] text-5xl font-bold tracking-tight sm:text-6xl"
          style={{
            textShadow:
              '0 0 40px rgba(106, 168, 255, 0.3), 0 0 90px rgba(106, 168, 255, 0.12)',
          }}
        >
          Anomaly
        </h1>
      </div>
      <p className="max-w-md text-base text-[var(--color-text-muted)] sm:text-lg">
        See how any codebase connects.
      </p>
    </div>
  );
}
