import { describe, it, expect } from 'vitest'
import { parseRepoUrl, isSourceFile, getFileExtension, getLanguageFromExt, truncate } from '../lib/utils'

describe('parseRepoUrl', () => {
  it('parses full GitHub URLs', () => {
    const result = parseRepoUrl('https://github.com/AaronCx/anomaly')
    expect(result).toEqual({ owner: 'AaronCx', repo: 'anomaly' })
  })

  it('strips .git suffix', () => {
    const result = parseRepoUrl('https://github.com/AaronCx/anomaly.git')
    expect(result).toEqual({ owner: 'AaronCx', repo: 'anomaly' })
  })

  it('parses owner/repo shorthand', () => {
    const result = parseRepoUrl('AaronCx/anomaly')
    expect(result).toEqual({ owner: 'AaronCx', repo: 'anomaly' })
  })

  it('returns null for invalid input', () => {
    expect(parseRepoUrl('not-a-repo')).toBeNull()
    expect(parseRepoUrl('')).toBeNull()
  })
})

describe('isSourceFile', () => {
  it('identifies source files', () => {
    expect(isSourceFile('app.ts')).toBe(true)
    expect(isSourceFile('component.tsx')).toBe(true)
    expect(isSourceFile('server.js')).toBe(true)
    expect(isSourceFile('main.py')).toBe(true)
  })

  it('rejects non-source files', () => {
    expect(isSourceFile('readme.md')).toBe(false)
    expect(isSourceFile('package.json')).toBe(false)
    expect(isSourceFile('image.png')).toBe(false)
  })
})

describe('getFileExtension', () => {
  it('returns correct extension', () => {
    expect(getFileExtension('app.ts')).toBe('ts')
    expect(getFileExtension('path/to/file.tsx')).toBe('tsx')
  })

  it('returns empty for no extension', () => {
    expect(getFileExtension('Dockerfile')).toBe('')
  })
})

describe('getLanguageFromExt', () => {
  it('maps extensions to languages', () => {
    expect(getLanguageFromExt('ts')).toBe('typescript')
    expect(getLanguageFromExt('js')).toBe('javascript')
    expect(getLanguageFromExt('py')).toBe('python')
  })

  it('returns unknown for unmapped extensions', () => {
    expect(getLanguageFromExt('xyz')).toBe('unknown')
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 5)).toBe('hell…')
  })

  it('returns short strings unchanged', () => {
    expect(truncate('hi', 10)).toBe('hi')
  })
})
