import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileType } from '@/lib/graph/types';

/** Tailwind class merge helper */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse a GitHub URL into { owner, repo } or null */
export function parseRepoUrl(
  raw: string,
): { owner: string; repo: string } | null {
  const trimmed = raw.trim().replace(/\/+$/, '');

  // owner/repo shorthand
  const shorthand = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/.exec(trimmed);
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] };

  // Full GitHub URL
  const urlMatch =
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/.exec(
      trimmed,
    );
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };

  return null;
}

/** Get file extension (without dot) */
export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/** Classify a file into a FileType by path heuristics */
export function classifyFileType(filePath: string): FileType {
  const lower = filePath.toLowerCase();
  const ext = getFileExtension(filePath);

  // Tests
  if (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('__tests__') ||
    lower.includes('__mocks__')
  ) {
    return 'test';
  }

  // Config files
  if (
    ext === 'json' ||
    ext === 'yaml' ||
    ext === 'yml' ||
    ext === 'toml' ||
    lower.includes('config') ||
    lower.includes('.env') ||
    lower.endsWith('.lock') ||
    lower.endsWith('rc.js') ||
    lower.endsWith('rc.ts') ||
    lower.endsWith('rc.mjs')
  ) {
    return 'config';
  }

  // Routes (Next.js / Remix / Express patterns)
  if (
    lower.includes('/app/') &&
    (lower.includes('page.') ||
      lower.includes('route.') ||
      lower.includes('layout.'))
  ) {
    return 'route';
  }
  if (lower.includes('/pages/') || lower.includes('/routes/')) {
    return 'route';
  }

  // Components
  if (
    lower.includes('/components/') ||
    lower.includes('/component/') ||
    lower.includes('.component.')
  ) {
    return 'component';
  }
  // TSX/JSX files are likely components
  if (ext === 'tsx' || ext === 'jsx') {
    return 'component';
  }

  // Services / API layers
  if (
    lower.includes('/services/') ||
    lower.includes('/service/') ||
    lower.includes('/api/') ||
    lower.includes('.service.')
  ) {
    return 'service';
  }

  // Models / types
  if (
    lower.includes('/models/') ||
    lower.includes('/model/') ||
    lower.includes('/types/') ||
    lower.includes('.model.') ||
    lower.includes('.types.') ||
    lower.endsWith('types.ts') ||
    lower.endsWith('types.js')
  ) {
    return 'model';
  }

  // Utilities
  if (
    lower.includes('/utils/') ||
    lower.includes('/util/') ||
    lower.includes('/helpers/') ||
    lower.includes('/lib/') ||
    lower.includes('.util.') ||
    lower.includes('.helper.')
  ) {
    return 'utility';
  }

  // Default for .ts/.js files
  if (ext === 'ts' || ext === 'js' || ext === 'mjs' || ext === 'mts') {
    return 'utility';
  }

  return 'unknown';
}
