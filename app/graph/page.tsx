'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import LoadingGraph from '@/components/shared/LoadingGraph';
import { parseFile } from '@/lib/parser';
import { loadFromGitHub } from '@/lib/loader/github-loader';
import type { ParsedFile } from '@/lib/parser/types';
import type { GraphData } from '@/lib/graph/types';
import { classifyFileType } from '@/lib/utils';
import { FILE_TYPE_COLORS } from '@/lib/constants';

/** Convert parsed files into graph data */
function buildGraph(parsed: ParsedFile[]): GraphData {
  const nodes = parsed.map((f) => {
    const fileType = classifyFileType(f.filePath);
    return {
      id: f.filePath,
      filePath: f.filePath,
      label: f.filePath.split('/').pop() ?? f.filePath,
      fileType,
      loc: f.loc,
      complexity: f.functions.length + f.calls.length,
      imports: f.imports.map((i) => i.source),
      exports: f.exports,
      functions: f.functions,
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));

  // Build edges from imports
  const edgeMap = new Map<string, number>();
  for (const file of parsed) {
    for (const imp of file.imports) {
      // Try to resolve the import to a file in the codebase
      const resolved = resolveImport(imp.source, file.filePath, nodeIds);
      if (resolved) {
        const key = `${file.filePath}|${resolved}`;
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
      }
    }
  }

  const edges = Array.from(edgeMap.entries()).map(([key, weight]) => {
    const [source, target] = key.split('|');
    return { source, target, weight };
  });

  // Build clusters by directory
  const clusterMap = new Map<string, string[]>();
  for (const node of nodes) {
    const dir = node.filePath.includes('/')
      ? node.filePath.split('/').slice(0, -1).join('/')
      : '.';
    if (!clusterMap.has(dir)) clusterMap.set(dir, []);
    clusterMap.get(dir)!.push(node.id);
  }

  const clusterColors = Object.values(FILE_TYPE_COLORS);
  const clusters = Array.from(clusterMap.entries()).map(
    ([dir, nodeIds], i) => ({
      id: dir,
      label: dir,
      color: clusterColors[i % clusterColors.length],
      nodeIds,
    }),
  );

  return { nodes, edges, clusters };
}

/** Try to resolve a relative/alias import to a file in the codebase */
function resolveImport(
  source: string,
  fromFile: string,
  nodeIds: Set<string>,
): string | null {
  // Skip external packages
  if (!source.startsWith('.') && !source.startsWith('@/') && !source.startsWith('~/')) {
    return null;
  }

  // Handle alias imports
  let resolved = source;
  if (source.startsWith('@/')) {
    resolved = source.slice(2);
  } else if (source.startsWith('~/')) {
    resolved = source.slice(2);
  } else {
    // Relative import
    const fromDir = fromFile.includes('/')
      ? fromFile.split('/').slice(0, -1).join('/')
      : '.';
    const parts = fromDir.split('/');
    for (const seg of source.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    resolved = parts.join('/');
  }

  // Try with common extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  for (const ext of extensions) {
    if (nodeIds.has(resolved + ext)) return resolved + ext;
  }

  return null;
}

function GraphPageInner() {
  const searchParams = useSearchParams();
  const demo = searchParams.get('demo');
  const repo = searchParams.get('repo');
  const local = searchParams.get('local');

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileCount, setFileCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let files: Map<string, string>;

        if (demo) {
          // Load pre-parsed demo
          const res = await fetch(`/demos/${demo}.json`);
          if (!res.ok) throw new Error(`Demo "${demo}" not found`);
          const data: GraphData = await res.json();
          if (!cancelled) {
            setGraphData(data);
            setLoading(false);
          }
          return;
        }

        if (local === 'true') {
          // Read files from sessionStorage
          const raw = sessionStorage.getItem('anomaly:local-files');
          if (!raw) throw new Error('No local files found. Please go back and drop your folder again.');
          const entries: { path: string; content: string }[] = JSON.parse(raw);
          files = new Map(entries.map((e) => [e.path, e.content]));
          sessionStorage.removeItem('anomaly:local-files');
        } else if (repo) {
          // Fetch from GitHub
          const [owner, repoName] = repo.split('/');
          if (!owner || !repoName) throw new Error('Invalid repo format');
          const token = typeof window !== 'undefined'
            ? localStorage.getItem('anomaly:gh-token') ?? undefined
            : undefined;
          files = await loadFromGitHub(owner, repoName, token, (loaded, total) => {
            if (!cancelled) setFileCount(total);
          });
        } else {
          throw new Error('No data source specified');
        }

        if (cancelled) return;
        setFileCount(files.size);

        // Parse all files
        const parsed: ParsedFile[] = [];
        for (const [path, content] of files) {
          parsed.push(parseFile(content, path));
        }

        const data = buildGraph(parsed);
        if (!cancelled) {
          setGraphData(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [demo, repo, local]);

  if (error) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-[var(--color-bg)]">
        <p className="text-red-400">{error}</p>
        <a href="/" className="text-sm text-[var(--color-accent)] underline underline-offset-2">
          Back to home
        </a>
      </div>
    );
  }

  if (loading || !graphData) {
    return <LoadingGraph fileCount={fileCount} />;
  }

  // Placeholder for the actual ForceGraph component
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-[var(--color-bg)]">
      <div className="flex flex-col items-center gap-2">
        <p className="font-[var(--font-mono)] text-sm text-[var(--color-text-muted)]">
          {graphData.nodes.length} nodes, {graphData.edges.length} edges
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Force graph visualization coming next
        </p>
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<LoadingGraph />}>
      <GraphPageInner />
    </Suspense>
  );
}
