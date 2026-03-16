import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import type { Node } from '@babel/types'
import { getFileExtension } from './utils'

// Handle ESM/CJS interop for @babel/traverse
const traverse = (typeof _traverse === 'function' ? _traverse : (_traverse as { default: typeof _traverse }).default) as typeof _traverse

export interface ParsedImport {
  source: string
  specifiers: string[]
}

export interface ParsedFunction {
  name: string
  line: number
  params: string[]
  body: string
  isExported: boolean
  returnType?: string
}

export interface ParsedCallExpression {
  callerFunction: string
  calleeName: string
  line: number
}

export interface ParsedRouteDefinition {
  method: string
  path: string
  handler: string
}

export interface ParsedFile {
  imports: ParsedImport[]
  exports: string[]
  functions: ParsedFunction[]
  callExpressions: ParsedCallExpression[]
  routeDefinitions: ParsedRouteDefinition[]
}

function getParserPlugins(filePath: string): ('jsx' | 'typescript' | 'decorators')[] {
  const ext = getFileExtension(filePath)
  const plugins: ('jsx' | 'typescript' | 'decorators')[] = ['decorators']

  if (ext === 'ts' || ext === 'tsx') {
    plugins.push('typescript')
  }
  if (ext === 'jsx' || ext === 'tsx' || ext === 'js') {
    plugins.push('jsx')
  }

  return plugins
}

function nodeToBodyString(node: Node | null | undefined, source: string): string {
  if (!node || node.start == null || node.end == null) return ''
  const body = source.slice(node.start, node.end)
  // Truncate very long function bodies
  if (body.length > 2000) {
    return body.slice(0, 2000) + '\n// ... truncated'
  }
  return body
}

function getParamNames(params: Node[]): string[] {
  return params.map((param) => {
    if (param.type === 'Identifier') return param.name
    if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
      return param.left.name
    }
    if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
      return `...${param.argument.name}`
    }
    if (param.type === 'ObjectPattern') return '{...}'
    if (param.type === 'ArrayPattern') return '[...]'
    return '?'
  })
}

export function parseFile(content: string, filePath: string): ParsedFile | null {
  const ext = getFileExtension(filePath)
  // Only parse JS/TS files with Babel
  if (!['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
    return null
  }

  let ast
  try {
    ast = parse(content, {
      sourceType: 'module',
      plugins: getParserPlugins(filePath),
      errorRecovery: true,
    })
  } catch {
    // Unparseable file - skip it
    return null
  }

  const result: ParsedFile = {
    imports: [],
    exports: [],
    functions: [],
    callExpressions: [],
    routeDefinitions: [],
  }

  // Track the current function scope for call expressions
  const functionStack: string[] = []

  try {
    traverse(ast, {
      // ── Imports ──────────────────────────────────────────
      ImportDeclaration(path) {
        const source = path.node.source.value
        const specifiers = path.node.specifiers.map((s) => {
          if (s.type === 'ImportDefaultSpecifier') return 'default'
          if (s.type === 'ImportNamespaceSpecifier') return '*'
          return s.imported.type === 'Identifier' ? s.imported.name : s.imported.value
        })
        result.imports.push({ source, specifiers })
      },

      // ── Exports ──────────────────────────────────────────
      ExportNamedDeclaration(path) {
        const decl = path.node.declaration
        if (decl) {
          if (decl.type === 'FunctionDeclaration' && decl.id) {
            result.exports.push(decl.id.name)
          } else if (decl.type === 'VariableDeclaration') {
            for (const declarator of decl.declarations) {
              if (declarator.id.type === 'Identifier') {
                result.exports.push(declarator.id.name)
              }
            }
          } else if (decl.type === 'ClassDeclaration' && decl.id) {
            result.exports.push(decl.id.name)
          }
        }
        for (const specifier of path.node.specifiers) {
          if (specifier.exported.type === 'Identifier') {
            result.exports.push(specifier.exported.name)
          }
        }
      },

      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          result.exports.push(decl.id.name)
        } else if (decl.type === 'Identifier') {
          result.exports.push(decl.name)
        } else {
          result.exports.push('default')
        }
      },

      // ── Functions ────────────────────────────────────────
      FunctionDeclaration: {
        enter(path) {
          const name = path.node.id?.name ?? '<anonymous>'
          const isExported =
            path.parent.type === 'ExportNamedDeclaration' ||
            path.parent.type === 'ExportDefaultDeclaration'
          const returnType = path.node.returnType?.type === 'TSTypeAnnotation'
            ? content.slice(path.node.returnType.start!, path.node.returnType.end!)
            : undefined

          result.functions.push({
            name,
            line: path.node.loc?.start.line ?? 0,
            params: getParamNames(path.node.params),
            body: nodeToBodyString(path.node.body, content),
            isExported,
            returnType,
          })
          functionStack.push(name)
        },
        exit() {
          functionStack.pop()
        },
      },

      // Arrow functions and function expressions assigned to variables
      VariableDeclarator(path) {
        if (path.node.id.type !== 'Identifier') return
        const init = path.node.init
        if (!init) return

        let funcNode: Node | null = null
        if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
          funcNode = init
        }

        if (!funcNode) return
        if (funcNode.type !== 'ArrowFunctionExpression' && funcNode.type !== 'FunctionExpression') return

        const name = path.node.id.name
        const grandParent = path.parentPath?.parent
        const isExported =
          grandParent?.type === 'ExportNamedDeclaration' ||
          grandParent?.type === 'ExportDefaultDeclaration'

        const returnType = funcNode.returnType?.type === 'TSTypeAnnotation'
          ? content.slice(funcNode.returnType.start!, funcNode.returnType.end!)
          : undefined

        result.functions.push({
          name,
          line: funcNode.loc?.start.line ?? 0,
          params: getParamNames(funcNode.params),
          body: nodeToBodyString(funcNode.body, content),
          isExported,
          returnType,
        })
      },

      // Enter/exit for arrow/function expressions for call tracking
      ArrowFunctionExpression: {
        enter(path) {
          const parent = path.parent
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            functionStack.push(parent.id.name)
          } else {
            functionStack.push('<anonymous>')
          }
        },
        exit() {
          functionStack.pop()
        },
      },

      FunctionExpression: {
        enter(path) {
          const parent = path.parent
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            functionStack.push(parent.id.name)
          } else if (path.node.id) {
            functionStack.push(path.node.id.name)
          } else {
            functionStack.push('<anonymous>')
          }
        },
        exit() {
          functionStack.pop()
        },
      },

      // ── Call Expressions ─────────────────────────────────
      CallExpression(path) {
        const callee = path.node.callee
        let calleeName = ''

        if (callee.type === 'Identifier') {
          calleeName = callee.name
        } else if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier'
        ) {
          const obj =
            callee.object.type === 'Identifier' ? callee.object.name : ''
          calleeName = obj ? `${obj}.${callee.property.name}` : callee.property.name
        }

        if (calleeName) {
          result.callExpressions.push({
            callerFunction: functionStack[functionStack.length - 1] ?? '<module>',
            calleeName,
            line: path.node.loc?.start.line ?? 0,
          })

          // Detect Express-style route definitions
          detectExpressRoute(calleeName, path.node, result, content)
        }
      },
    })
  } catch {
    // If traversal fails partially, return what we have
  }

  // Detect Next.js route exports
  detectNextjsRoutes(filePath, result)

  return result
}

function detectExpressRoute(
  calleeName: string,
  node: Node & { arguments?: Node[] },
  result: ParsedFile,
  _content: string
): void {
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']
  const routePrefixes = ['app', 'router', 'server']

  for (const prefix of routePrefixes) {
    for (const method of methods) {
      if (calleeName === `${prefix}.${method}`) {
        const args = node.arguments ?? []
        if (args.length >= 2 && args[0].type === 'StringLiteral') {
          const pathArg = args[0]
          const handlerArg = args[args.length - 1]
          let handler = '<anonymous>'
          if (handlerArg.type === 'Identifier') {
            handler = handlerArg.name
          }

          result.routeDefinitions.push({
            method: method.toUpperCase(),
            path: pathArg.value,
            handler,
          })
        }
        return
      }
    }
  }
}

function detectNextjsRoutes(filePath: string, result: ParsedFile): void {
  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

  // Next.js App Router: app/**/route.ts
  if (/app\/.*route\.(ts|js)x?$/.test(filePath)) {
    const routePath = filePath
      .replace(/^.*?app/, '')
      .replace(/\/route\.(ts|js)x?$/, '')
      .replace(/\/\[([^\]]+)\]/g, '/:$1')
      || '/'

    for (const method of httpMethods) {
      if (result.exports.includes(method)) {
        const fn = result.functions.find((f) => f.name === method)
        result.routeDefinitions.push({
          method,
          path: routePath,
          handler: fn?.name ?? method,
        })
      }
    }
  }

  // Next.js Pages API: pages/api/**/*.ts
  if (/pages\/api\/.*\.(ts|js)x?$/.test(filePath)) {
    const routePath = filePath
      .replace(/^.*?pages\/api/, '/api')
      .replace(/\.(ts|js)x?$/, '')
      .replace(/\/index$/, '')
      .replace(/\/\[([^\]]+)\]/g, '/:$1')
      || '/api'

    if (result.exports.includes('default')) {
      result.routeDefinitions.push({
        method: 'ALL',
        path: routePath,
        handler: 'default',
      })
    }
  }
}
