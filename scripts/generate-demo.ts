#!/usr/bin/env bun
/**
 * Generate a pre-parsed demo JSON file from a local repository.
 *
 * Usage:
 *   bun scripts/generate-demo.ts /path/to/repo output-name
 *
 * Output:
 *   public/demos/<output-name>.json
 */

import { readdir, readFile, stat, mkdir } from 'node:fs/promises';
import { join, resolve, extname, relative } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { buildGraph } from '@/lib/graph/graph-builder';

// ── Config ────────────────────────────────────────────────────────────────

/** Directories to skip entirely. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
  '.cache',
  '__pycache__',
  'venv',
  '.venv',
  'env',
  '.env',
  'coverage',
  '.svn',
  '.hg',
  'vendor',
  'target',       // Java/Rust build output
  '.idea',
  '.vscode',
]);

/** File extensions we can parse. */
const PARSEABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx',
  '.py',
  '.java',
]);

/** Max file size to parse (256 KB). Skip huge generated/minified files. */
const MAX_FILE_SIZE = 256 * 1024;

// ── Helpers ───────────────────────────────────────────────────────────────

async function collectFiles(
  dir: string,
  rootDir: string,
  files: Map<string, string>,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Permission denied or broken symlink — skip
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await collectFiles(fullPath, rootDir, files);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name);
    if (!PARSEABLE_EXTENSIONS.has(ext)) continue;

    // Skip large files
    try {
      const info = await stat(fullPath);
      if (info.size > MAX_FILE_SIZE) continue;
    } catch {
      continue;
    }

    const relPath = relative(rootDir, fullPath);
    try {
      const content = await readFile(fullPath, 'utf-8');
      files.set(relPath, content);
    } catch {
      // Skip unreadable files
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: bun scripts/generate-demo.ts <repo-path> <output-name>');
  process.exit(1);
}

const repoPath = resolve(args[0]);
const outputName = args[1];

console.log(`Scanning ${repoPath} ...`);

const files = new Map<string, string>();
await collectFiles(repoPath, repoPath, files);

console.log(`Found ${files.size} parseable files.`);

if (files.size === 0) {
  console.error('No parseable files found. Exiting.');
  process.exit(1);
}

console.log('Building graph...');
const graph = buildGraph(files);

console.log(
  `Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.clusters.length} clusters`,
);

// Write output
const outDir = resolve(import.meta.dir, '..', 'public', 'demos');
await mkdir(outDir, { recursive: true });

const outPath = join(outDir, `${outputName}.json`);
await writeFile(outPath, JSON.stringify(graph));

console.log(`Written to ${outPath}`);
