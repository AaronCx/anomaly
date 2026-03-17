'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { parseRepoUrl } from '@/lib/utils'
import { COLORS } from '@/lib/constants'

export default function RepoInput() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = parseRepoUrl(url.trim())
    if (!parsed) {
      setError('Enter a valid GitHub URL or owner/repo')
      return
    }

    router.push(`/graph?repo=${parsed.owner}/${parsed.repo}`)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div
        className="flex items-center gap-3 rounded-xl border p-2 transition-colors duration-200 focus-within:border-accent"
        style={{
          backgroundColor: COLORS.surface,
          borderColor: error ? '#ef4444' : COLORS.border,
        }}
      >
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (error) setError(null)
          }}
          placeholder="owner/repo or full URL"
          className="flex-1 bg-transparent px-4 py-3 font-mono text-sm sm:text-base outline-none placeholder:opacity-40"
          style={{ color: '#e2e8f0' }}
          autoFocus
        />
        <button
          type="submit"
          disabled={!url.trim()}
          className="flex items-center gap-2 rounded-lg px-4 sm:px-6 py-3 font-semibold text-white transition-all duration-200 disabled:opacity-40 cursor-pointer text-sm sm:text-base"
          style={{ backgroundColor: COLORS.accent }}
        >
          Analyze →
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
