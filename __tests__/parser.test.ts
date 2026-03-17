import { describe, it, expect } from 'vitest'
import { parseFile } from '../lib/parser'

describe('parseFile', () => {
  it('extracts function declarations', () => {
    const code = `
      function hello(name) {
        return 'Hello ' + name
      }
      const greet = (person) => {
        return hello(person)
      }
    `
    const result = parseFile(code, 'test.js')
    expect(result).not.toBeNull()
    expect(result!.functions.length).toBeGreaterThanOrEqual(2)
    const hello = result!.functions.find(f => f.name === 'hello')
    expect(hello).toBeDefined()
    expect(hello!.params).toContain('name')
  })

  it('extracts imports', () => {
    const code = `
      import { Router } from 'express'
      import path from 'path'
      import { readFile, writeFile } from 'fs/promises'
    `
    const result = parseFile(code, 'test.ts')
    expect(result).not.toBeNull()
    expect(result!.imports).toHaveLength(3)
    expect(result!.imports[0].source).toBe('express')
    expect(result!.imports[0].specifiers).toContain('Router')
    expect(result!.imports[2].specifiers).toContain('readFile')
  })

  it('extracts exports', () => {
    const code = `
      export function handleLogin() {}
      export const SECRET = 'abc'
      export default class UserService {}
    `
    const result = parseFile(code, 'test.ts')
    expect(result).not.toBeNull()
    expect(result!.exports).toContain('handleLogin')
    expect(result!.exports).toContain('SECRET')
  })

  it('detects Express route definitions', () => {
    const code = `
      import { Router } from 'express'
      const router = Router()
      router.get('/users', getUsers)
      router.post('/users', createUser)
      router.delete('/users/:id', deleteUser)
    `
    const result = parseFile(code, 'routes/users.ts')
    expect(result).not.toBeNull()
    expect(result!.routeDefinitions.length).toBeGreaterThanOrEqual(3)
    const getRoute = result!.routeDefinitions.find(r => r.method === 'GET' && r.path === '/users')
    expect(getRoute).toBeDefined()
    const postRoute = result!.routeDefinitions.find(r => r.method === 'POST')
    expect(postRoute).toBeDefined()
  })

  it('extracts call expressions', () => {
    const code = `
      function processData(input) {
        const validated = validate(input)
        const result = transform(validated)
        return save(result)
      }
    `
    const result = parseFile(code, 'test.js')
    expect(result).not.toBeNull()
    const calls = result!.callExpressions.filter(c => c.callerFunction === 'processData')
    expect(calls.length).toBeGreaterThanOrEqual(3)
    const callNames = calls.map(c => c.calleeName)
    expect(callNames).toContain('validate')
    expect(callNames).toContain('transform')
    expect(callNames).toContain('save')
  })

  it('handles TypeScript with types', () => {
    const code = `
      interface User {
        id: string
        name: string
      }
      function getUser(id: string): Promise<User> {
        return db.findOne({ id })
      }
      export { getUser }
    `
    const result = parseFile(code, 'test.ts')
    expect(result).not.toBeNull()
    expect(result!.functions.find(f => f.name === 'getUser')).toBeDefined()
    expect(result!.exports).toContain('getUser')
  })

  it('handles JSX/TSX gracefully', () => {
    const code = `
      import React from 'react'
      export function Button({ label }: { label: string }) {
        return <button className="btn">{label}</button>
      }
    `
    const result = parseFile(code, 'Button.tsx')
    expect(result).not.toBeNull()
    expect(result!.functions.find(f => f.name === 'Button')).toBeDefined()
  })

  it('handles unparseable content gracefully', () => {
    // Babel is lenient — it may return an empty result rather than null
    const result = parseFile('this is not valid code {{{}}}', 'test.js')
    if (result) {
      expect(result.functions).toHaveLength(0)
    } else {
      expect(result).toBeNull()
    }
  })
})
