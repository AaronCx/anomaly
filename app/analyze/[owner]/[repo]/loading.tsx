import { BG_COLOR, TEXT_DIM, ACCENT } from '@/lib/color-schemes'

export default function AnalysisLoading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6"
      style={{ backgroundColor: BG_COLOR }}
    >
      {/* Spinner */}
      <div className="relative h-12 w-12">
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: ACCENT, borderRightColor: ACCENT + '40' }}
        />
        <div
          className="absolute inset-2 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: ACCENT + '80',
            animationDirection: 'reverse',
            animationDuration: '1.5s',
          }}
        />
      </div>

      {/* Message with progress dots */}
      <div className="flex items-center gap-1 font-mono text-sm" style={{ color: TEXT_DIM }}>
        <span>Analyzing repository</span>
        <span className="flex gap-0.5">
          <span className="animate-pulse-dot" style={{ animationDelay: '0s' }}>.</span>
          <span className="animate-pulse-dot" style={{ animationDelay: '0.2s' }}>.</span>
          <span className="animate-pulse-dot" style={{ animationDelay: '0.4s' }}>.</span>
        </span>
      </div>
    </div>
  )
}
