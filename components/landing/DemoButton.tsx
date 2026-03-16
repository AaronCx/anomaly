'use client'

import { useRouter } from 'next/navigation'
import { CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_DIM } from '@/lib/color-schemes'

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
        backgroundColor: CARD_BG,
        borderColor: CARD_BORDER,
        color: TEXT_DIM,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3b82f6'
        e.currentTarget.style.color = TEXT_PRIMARY
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = CARD_BORDER
        e.currentTarget.style.color = TEXT_DIM
      }}
    >
      {label || `${owner}/${repo}`}
    </button>
  )
}
