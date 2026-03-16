'use client'

import Link from 'next/link'

export default function AnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
      <div
        className="max-w-md w-full p-8 rounded-xl text-center"
        style={{ background: '#151520', border: '1px solid #1e1e2e' }}
      >
        <div className="text-4xl mb-4">!</div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: '#e2e8f0' }}>
          Analysis Failed
        </h2>
        <p className="mb-6 text-sm" style={{ color: '#64748b' }}>
          {error.message || 'Something went wrong while analyzing this repository.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: '#1e1e2e', color: '#e2e8f0' }}
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
