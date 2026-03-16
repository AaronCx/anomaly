import type { RouteNode } from './types'
import type { ParsedFile } from './parser'
import { generateId } from './utils'

/**
 * Detect all routes across parsed files.
 * Supports Express, Next.js App Router, Next.js Pages API, and FastAPI patterns.
 */
export function detectRoutes(
  parsedFiles: Map<string, ParsedFile>
): RouteNode[] {
  const routes: RouteNode[] = []

  for (const [filePath, parsed] of parsedFiles) {
    // Routes already detected by the parser (Express + Next.js)
    for (const route of parsed.routeDefinitions) {
      routes.push({
        id: generateId(),
        method: route.method,
        path: route.path,
        handlerName: route.handler,
        filePath,
        lineNumber: findHandlerLine(parsed, route.handler),
        framework: detectFramework(filePath, parsed),
      })
    }

    // Detect FastAPI-style decorators from call expressions
    const fastApiRoutes = detectFastAPIRoutes(filePath, parsed)
    routes.push(...fastApiRoutes)
  }

  return deduplicateRoutes(routes)
}

function findHandlerLine(parsed: ParsedFile, handlerName: string): number {
  const fn = parsed.functions.find((f) => f.name === handlerName)
  return fn?.line ?? 0
}

function detectFramework(filePath: string, parsed: ParsedFile): string {
  // Next.js App Router
  if (/app\/.*route\.(ts|js)x?$/.test(filePath)) {
    return 'nextjs-app'
  }

  // Next.js Pages API
  if (/pages\/api\/.*\.(ts|js)x?$/.test(filePath)) {
    return 'nextjs-pages'
  }

  // Express detection via imports
  const hasExpress = parsed.imports.some(
    (imp) => imp.source === 'express' || imp.source.includes('express')
  )
  if (hasExpress) return 'express'

  // Fastify detection
  const hasFastify = parsed.imports.some(
    (imp) => imp.source === 'fastify' || imp.source.includes('fastify')
  )
  if (hasFastify) return 'fastify'

  // Hono detection
  const hasHono = parsed.imports.some(
    (imp) => imp.source === 'hono' || imp.source.includes('hono')
  )
  if (hasHono) return 'hono'

  return 'unknown'
}

/**
 * Detect FastAPI-style routes from decorator-like patterns.
 * Since Babel can't parse Python, this looks for patterns in
 * call expressions that match @app.get("/path") etc.
 */
function detectFastAPIRoutes(
  filePath: string,
  parsed: ParsedFile
): RouteNode[] {
  // FastAPI detection only applies to Python files, which we can't parse with Babel.
  // This is a placeholder for future Python AST support.
  // For now, we can detect patterns from call expressions in JS/TS
  // that wrap route-like decorators (e.g., decorator libraries).

  const routes: RouteNode[] = []
  const methods = ['get', 'post', 'put', 'delete', 'patch']

  for (const call of parsed.callExpressions) {
    for (const method of methods) {
      // Match patterns like: app.get("/path") or router.post("/path")
      // These are already handled by the parser for Express,
      // but also catch other frameworks with similar patterns
      if (
        call.calleeName.endsWith(`.${method}`) &&
        !call.calleeName.startsWith('app.') &&
        !call.calleeName.startsWith('router.') &&
        !call.calleeName.startsWith('server.')
      ) {
        routes.push({
          id: generateId(),
          method: method.toUpperCase(),
          path: `[dynamic:${call.calleeName}]`,
          handlerName: call.callerFunction,
          filePath,
          lineNumber: call.line,
          framework: 'unknown',
        })
      }
    }
  }

  return routes
}

function deduplicateRoutes(routes: RouteNode[]): RouteNode[] {
  const seen = new Set<string>()
  return routes.filter((route) => {
    const key = `${route.method}:${route.path}:${route.filePath}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
