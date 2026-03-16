import { NextResponse } from 'next/server'
import { getAnalysis } from '@/lib/store'
import type { AnnotationRequest, FunctionNode } from '@/lib/types'

export async function POST(
  request: Request,
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

    const body = (await request.json()) as AnnotationRequest
    const { functionIds } = body

    if (!functionIds || !Array.isArray(functionIds) || functionIds.length === 0) {
      return NextResponse.json(
        { error: 'functionIds array is required' },
        { status: 400 }
      )
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured, annotations unavailable' },
        { status: 503 }
      )
    }

    // Find the requested functions across all files
    const functionsToAnnotate: FunctionNode[] = []
    for (const fileNode of analysis.files) {
      for (const fn of fileNode.functions) {
        if (functionIds.includes(fn.id)) {
          functionsToAnnotate.push(fn)
        }
      }
    }

    if (functionsToAnnotate.length === 0) {
      return NextResponse.json(
        { error: 'No matching functions found' },
        { status: 404 }
      )
    }

    // Mark functions as loading
    for (const fn of functionsToAnnotate) {
      fn.annotationLoading = true
    }

    // Generate annotations using OpenAI
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey })

    const annotationPromises = functionsToAnnotate.map(async (fn) => {
      try {
        const prompt = buildAnnotationPrompt(fn)
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a senior code reviewer. Provide a concise 1-2 sentence annotation explaining what this function does, its purpose in the codebase, and any notable patterns or concerns. Be specific and technical.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 150,
          temperature: 0.3,
        })

        const annotation =
          response.choices[0]?.message?.content?.trim() ?? 'No annotation generated'
        fn.annotation = annotation
        fn.annotationLoading = false
        return { id: fn.id, annotation }
      } catch (err) {
        fn.annotationLoading = false
        console.error(`Failed to annotate ${fn.id}:`, err)
        return { id: fn.id, annotation: 'Annotation failed' }
      }
    })

    const results = await Promise.allSettled(annotationPromises)
    const annotations: Record<string, string> = {}

    for (const result of results) {
      if (result.status === 'fulfilled') {
        annotations[result.value.id] = result.value.annotation
      }
    }

    return NextResponse.json({ annotations })
  } catch (err) {
    console.error('Annotate endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function buildAnnotationPrompt(fn: FunctionNode): string {
  const bodyPreview =
    fn.body.length > 1000 ? fn.body.slice(0, 1000) + '\n// ...' : fn.body

  return [
    `Function: ${fn.name}`,
    `File: ${fn.filePath}`,
    `Layer: ${fn.layer}`,
    `Parameters: ${fn.params.join(', ') || 'none'}`,
    fn.returnType ? `Return type: ${fn.returnType}` : '',
    `Exported: ${fn.isExported}`,
    `Complexity: ${fn.complexity}`,
    '',
    'Code:',
    '```',
    bodyPreview,
    '```',
  ]
    .filter(Boolean)
    .join('\n')
}
