export default function HeroSection() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1
        className="font-[var(--font-mono)] text-5xl font-bold tracking-tight sm:text-6xl"
        style={{
          textShadow: '0 0 40px rgba(96, 165, 250, 0.25), 0 0 80px rgba(96, 165, 250, 0.1)',
        }}
      >
        Anomaly
      </h1>
      <p className="max-w-md text-lg text-[var(--color-text-muted)]">
        See how any codebase connects.
      </p>
    </div>
  );
}
