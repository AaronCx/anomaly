import { describe, it, expect } from 'vitest'
import { parseRepoUrl, getFileExtension } from '../lib/utils'

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

describe('getFileExtension', () => {
  it('returns correct extension', () => {
    expect(getFileExtension('app.ts')).toBe('ts')
    expect(getFileExtension('path/to/file.tsx')).toBe('tsx')
  })

  it('returns empty for no extension', () => {
    expect(getFileExtension('Dockerfile')).toBe('')
  })
})
