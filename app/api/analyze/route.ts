import { NextResponse } from 'next/server'
import type { AnalyzeRequest, AnalyzeResponse, AnalysisResult } from '@/lib/types'
import { parseRepoUrl, generateId } from '@/lib/utils'
import { setAnalysis, updateAnalysisStatus } from '@/lib/store'
import { getRepoInfo, fetchRepoTree, fetchFilesInBatches } from '@/lib/github'
import { parseFile, type ParsedFile } from '@/lib/parser'
import { detectRoutes } from '@/lib/route-detector'
import { buildModuleGraph } from '@/lib/module-analyzer'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest
    const { repoUrl } = body

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'repoUrl is required' },
        { status: 400 }
      )
    }

    const parsed = parseRepoUrl(repoUrl)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      )
    }

    const { owner, repo } = parsed
    const id = generateId()

    // Initialize analysis in the store
    const initial: AnalysisResult = {
      id,
      owner,
      repo,
      branch: '',
      commitSha: '',
      language: '',
      files: [],
      modules: { nodes: [], edges: [], clusters: [] },
      routes: [],
      status: 'cloning',
      createdAt: new Date().toISOString(),
    }
    setAnalysis(id, initial)
    updateAnalysisStatus(id, 'cloning', 0, 'Fetching repository metadata...')

    // Run analysis synchronously (within Vercel's time limits)
    // We use a fire-and-forget pattern but await as much as we can
    runAnalysis(id, owner, repo).catch((err) => {
      console.error(`Analysis ${id} failed:`, err)
      updateAnalysisStatus(id, 'error', 0, String(err))
    })

    const response: AnalyzeResponse = { id, owner, repo }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Analyze endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function runAnalysis(id: string, owner: string, repo: string) {
  // Step 1: Get repo info
  updateAnalysisStatus(id, 'cloning', 5, 'Fetching repository info...')
  const repoInfo = await getRepoInfo(owner, repo)

  const analysis = (await import('@/lib/store')).getAnalysis(id)
  if (!analysis) return

  analysis.branch = repoInfo.defaultBranch
  analysis.language = repoInfo.language

  // Step 2: Fetch file tree
  updateAnalysisStatus(id, 'cloning', 15, 'Scanning repository files...')
  const tree = await fetchRepoTree(owner, repo)

  if (tree.length === 0) {
    updateAnalysisStatus(id, 'complete', 100, 'No source files found')
    return
  }

  const totalFiles = tree.length
  updateAnalysisStatus(
    id, 'parsing', 20,
    `Fetching ${totalFiles} source files...`,
    0, totalFiles
  )

  // Step 3: Fetch file contents in batches
  const fileContents = await fetchFilesInBatches(
    owner, repo, tree, 10,
    (processed, total) => {
      const progress = 20 + Math.floor((processed / total) * 40)
      updateAnalysisStatus(
        id, 'parsing', progress,
        `Fetched ${processed}/${total} files`,
        processed, total
      )
    }
  )

  // Step 4: Parse all files
  updateAnalysisStatus(id, 'parsing', 60, 'Parsing source files...')
  const parsedFiles = new Map<string, ParsedFile>()

  for (const [filePath, content] of fileContents) {
    const parsed = parseFile(content, filePath)
    if (parsed) {
      parsedFiles.set(filePath, parsed)
    }
  }

  updateAnalysisStatus(
    id, 'analyzing', 70,
    `Parsed ${parsedFiles.size} files, building dependency graph...`,
    parsedFiles.size, totalFiles
  )

  // Step 5: Build module graph
  const modules = buildModuleGraph(parsedFiles, fileContents)

  // Step 6: Detect routes
  updateAnalysisStatus(id, 'analyzing', 85, 'Detecting API routes...')
  const routes = detectRoutes(parsedFiles)

  // Step 7: Store the parsed files for later use (trace, function graph)
  // We stash them on the analysis object using a non-typed field
  const finalAnalysis = (await import('@/lib/store')).getAnalysis(id)
  if (!finalAnalysis) return

  finalAnalysis.files = modules.nodes
  finalAnalysis.modules = modules
  finalAnalysis.routes = routes
  finalAnalysis.status = 'complete'

  // Store parsed files map for route tracing and function graphs
  ;(finalAnalysis as AnalysisResultWithParsed)._parsedFiles = parsedFiles
  ;(finalAnalysis as AnalysisResultWithParsed)._fileContents = fileContents

  updateAnalysisStatus(
    id, 'complete', 100,
    `Analysis complete: ${modules.nodes.length} files, ${routes.length} routes`,
    parsedFiles.size, totalFiles
  )
}

// Extended type to store parsed data for subsequent API calls
export interface AnalysisResultWithParsed extends AnalysisResult {
  _parsedFiles?: Map<string, ParsedFile>
  _fileContents?: Map<string, string>
}
