'use client'

import { useRouter } from 'next/navigation'
import { COLORS } from '@/lib/constants'

interface DemoButtonProps {
  owner: string
  repo: string
  demoId: string
  label?: string
}

export default function DemoButton({ owner, repo, demoId, label }: DemoButtonProps) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push(`/analyze/${owner}/${repo}?id=${demoId}`)}
      className="rounded-full border px-4 py-1.5 font-mono text-sm transition-all duration-200 hover:border-accent hover:text-accent cursor-pointer"
      style={{
        backgroundColor: COLORS.surface,
        borderColor: COLORS.border,
        color: COLORS.textMuted,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3b82f6'
        e.currentTarget.style.color = COLORS.text
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLORS.border
        e.currentTarget.style.color = COLORS.textMuted
      }}
    >
      {label || `${owner}/${repo}`}
    </button>
  )
}
