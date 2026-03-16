'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { parseRepoUrl } from '@/lib/utils'
import { analyzeRepo } from '@/lib/api'
import { CARD_BG, CARD_BORDER, ACCENT, TEXT_DIM } from '@/lib/color-schemes'

export default function RepoInput() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = parseRepoUrl(url.trim())
    if (!parsed) {
      setError('Enter a valid GitHub URL or owner/repo')
      return
    }

    setLoading(true)
    try {
      const result = await analyzeRepo(`https://github.com/${parsed.owner}/${parsed.repo}`)
      // Store full analysis in sessionStorage — Vercel serverless can't share in-memory state
      if (result.id) {
        sessionStorage.setItem(`anomaly-analysis-${result.id}`, JSON.stringify(result))
      }
      router.push(`/analyze/${parsed.owner}/${parsed.repo}?id=${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div
        className="flex items-center gap-3 rounded-xl border p-2 transition-colors duration-200 focus-within:border-accent"
        style={{
          backgroundColor: CARD_BG,
          borderColor: error ? '#ef4444' : CARD_BORDER,
        }}
      >
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (error) setError(null)
          }}
          placeholder="https://github.com/owner/repo"
          disabled={loading}
          className="flex-1 bg-transparent px-4 py-3 font-mono text-base outline-none placeholder:opacity-40 disabled:opacity-50"
          style={{ color: '#e2e8f0' }}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition-all duration-200 disabled:opacity-40 cursor-pointer"
          style={{ backgroundColor: ACCENT }}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyzing...
            </span>
          ) : (
            'Analyze'
          )}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
    </form>
  )
}
