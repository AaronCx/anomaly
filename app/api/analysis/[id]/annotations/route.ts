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

    // Collect all annotations from function nodes across all files
    const annotations: Record<string, string> = {}

    for (const fileNode of analysis.files) {
      for (const fn of fileNode.functions) {
        if (fn.annotation) {
          annotations[fn.id] = fn.annotation
        }
      }
    }

    return NextResponse.json(annotations)
  } catch (err) {
    console.error('Annotations endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
