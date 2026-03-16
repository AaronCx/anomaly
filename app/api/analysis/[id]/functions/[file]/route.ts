import { NextResponse } from 'next/server'
import { getAnalysis } from '@/lib/store'
import { buildFunctionGraph } from '@/lib/call-tracer'
import type { AnalysisResultWithParsed } from '@/app/api/analyze/route'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> }
) {
  try {
    const { id, file } = await params
    const filePath = decodeURIComponent(file)

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

    // Get parsed files from the extended analysis object
    const parsedFiles = (analysis as AnalysisResultWithParsed)._parsedFiles
    if (!parsedFiles) {
      return NextResponse.json(
        { error: 'Parsed file data not available' },
        { status: 500 }
      )
    }

    // Check the file exists in our parsed data
    if (!parsedFiles.has(filePath)) {
      return NextResponse.json(
        { error: `File not found in analysis: ${filePath}` },
        { status: 404 }
      )
    }

    const graph = buildFunctionGraph(filePath, parsedFiles)
    return NextResponse.json(graph)
  } catch (err) {
    console.error('Functions endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
