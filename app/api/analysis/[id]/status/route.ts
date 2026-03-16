import { NextResponse } from 'next/server'
import { getAnalysis, getProgress } from '@/lib/store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const analysis = getAnalysis(id)
    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }

    const progress = getProgress(id)
    if (progress) {
      return NextResponse.json(progress)
    }

    // Fallback: construct progress from the analysis status
    return NextResponse.json({
      status: analysis.status,
      progress: analysis.status === 'complete' ? 100 : 0,
      message: analysis.status,
      filesProcessed: analysis.files.length,
      totalFiles: analysis.files.length,
    })
  } catch (err) {
    console.error('Status endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
