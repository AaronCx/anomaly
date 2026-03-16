'use client'

import { useState, useEffect, useCallback } from 'react'
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

  const fetchTrace = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await traceRoute(analysisId, path)
      setTrace(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trace route')
    } finally {
      setIsLoading(false)
    }
  }, [analysisId])

  useEffect(() => {
    if (!routePath) return
    fetchTrace(routePath)
  }, [routePath, fetchTrace])

  // When routePath becomes null, trace is stale but not reset synchronously
  // Consumer should check routePath to know if trace is relevant
  const effectiveTrace = routePath ? trace : null

  return { trace: effectiveTrace, isLoading, error }
}
