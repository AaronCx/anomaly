import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // Handle full URLs: https://github.com/owner/repo
  const urlMatch = url.match(/github\.com\/([^\/]+)\/([^\/\s#?]+)/)
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') }
  }

  // Handle owner/repo shorthand
  const shortMatch = url.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] }
  }

  return null
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

export function isSourceFile(filePath: string): boolean {
  const ext = getFileExtension(filePath)
  const sourceExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'rb']
  return sourceExts.includes(ext)
}

export function getLanguageFromExt(ext: string): string {
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
  }
  return map[ext] || 'unknown'
}

export function getRelativePath(filePath: string, basePath: string): string {
  return filePath.replace(basePath, '').replace(/^\//, '')
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}
