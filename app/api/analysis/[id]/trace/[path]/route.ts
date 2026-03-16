import { NextResponse } from 'next/server'
import { getAnalysis } from '@/lib/store'
import { buildRouteTrace } from '@/lib/route-trace-builder'
import type { AnalysisResultWithParsed } from '@/app/api/analyze/route'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; path: string }> }
) {
  try {
    const { id, path: routePath } = await params
    const decodedPath = decodeURIComponent(routePath)

    const analysis = getAnalysis(id)
    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }

    if (analysis.status !== 'complete' && analysis.status !== 'annotating') {
      return NextResponse.json(
        { error: 'Analysis not yet complete', status: analysis.status },
        { status: 202 }
      )
    }

    // Find matching route
    const route = analysis.routes.find(
      (r) => r.path === decodedPath || r.id === decodedPath
    )
    if (!route) {
      return NextResponse.json(
        { error: `Route not found: ${decodedPath}` },
        { status: 404 }
      )
    }

    // Get parsed files from the extended analysis object
    const parsedFiles = (analysis as AnalysisResultWithParsed)._parsedFiles
    if (!parsedFiles) {
      return NextResponse.json(
        { error: 'Parsed file data not available' },
        { status: 500 }
      )
    }

    const trace = buildRouteTrace(route, parsedFiles)
    return NextResponse.json(trace)
  } catch (err) {
    console.error('Trace endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
