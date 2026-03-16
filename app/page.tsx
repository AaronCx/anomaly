import RepoInput from '@/components/landing/RepoInput'
import DemoButton from '@/components/landing/DemoButton'

const DEMOS = [
  { owner: 'jondot', repo: 'AgentForge', demoId: 'demo-agentforge' },
  { owner: 'AaronCx', repo: 'LastGate', demoId: 'demo-lastgate' },
  { owner: 'expressjs', repo: 'express', demoId: 'demo-express' },
  { owner: 'fastapi', repo: 'fastapi', demoId: 'demo-fastapi' },
]

export default function Home() {
  return (
    <div className="grid-bg relative flex min-h-screen flex-col items-center justify-center px-6">
      {/* Radial gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(59,130,246,0.06) 0%, transparent 70%)',
        }}
      />

      <main className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo */}
        <h1 className="text-glow animate-fade-in-up font-mono text-6xl font-bold tracking-tight sm:text-7xl">
          Anomaly
        </h1>

        {/* Tagline */}
        <p className="animate-fade-in-up animation-delay-100 max-w-lg text-center text-lg leading-relaxed text-text-dim">
          Point it at any repo. See how the whole thing works in 30 seconds.
        </p>

        {/* Input */}
        <div className="animate-fade-in-up animation-delay-200 w-full max-w-2xl">
          <RepoInput />
        </div>

        {/* Demo buttons */}
        <div className="animate-fade-in-up animation-delay-300 flex flex-col items-center gap-3">
          <span className="text-sm text-text-dim">Or try:</span>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMOS.map((d) => (
              <DemoButton
                key={d.demoId}
                owner={d.owner}
                repo={d.repo}
                demoId={d.demoId}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
