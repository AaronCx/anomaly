import { NextResponse } from 'next/server'
import { getAnalysis } from '@/lib/store'

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

    if (analysis.status !== 'complete' && analysis.status !== 'annotating') {
      return NextResponse.json(
        { error: 'Analysis not yet complete', status: analysis.status },
        { status: 202 }
      )
    }

    return NextResponse.json(analysis.modules)
  } catch (err) {
    console.error('Modules endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
