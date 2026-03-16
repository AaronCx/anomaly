'use client'

import { useState, useEffect } from 'react'
import type { RouteTrace } from '@/lib/types'
import { traceRoute } from '@/lib/api'

interface UseRouteTraceReturn {
  trace: RouteTrace | null
  isLoading: boolean
  error: string | null
}

export function useRouteTrace(
  analysisId: string,
  routePath: string | null
): UseRouteTraceReturn {
  const [trace, setTrace] = useState<RouteTrace | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!routePath) {
      setTrace(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    traceRoute(analysisId, routePath)
      .then((result) => {
        if (!cancelled) {
          setTrace(result)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to trace route')
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [analysisId, routePath])

  return { trace, isLoading, error }
}
