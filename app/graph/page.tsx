'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';
import LoadingGraph from '@/components/shared/LoadingGraph';
import ForceGraph from '@/components/graph/ForceGraph';
import NodeTooltip from '@/components/graph/NodeTooltip';
import DetailPanel from '@/components/graph/DetailPanel';
import SearchOverlay from '@/components/graph/SearchOverlay';
import FilterBar from '@/components/graph/FilterBar';
import GraphControls from '@/components/graph/GraphControls';
import Minimap from '@/components/graph/Minimap';
import Legend from '@/components/graph/Legend';
import { parseFile } from '@/lib/parser';
import { loadFromGitHub } from '@/lib/loader/github-loader';
import type { ParsedFile } from '@/lib/parser/types';
import type { GraphData, GraphNode, FileType, EdgeType } from '@/lib/graph/types';
import { classifyFileType } from '@/lib/utils';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { useGraphFilters } from '@/hooks/useGraphFilters';
import { useSearch } from '@/hooks/useSearch';

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
      const resolved = resolveImport(imp.source, file.filePath, nodeIds);
      if (resolved) {
        const key = `${file.filePath}|${resolved}`;
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
      }
    }
  }

  const edges = Array.from(edgeMap.entries()).map(([key, weight]) => {
    const [source, target] = key.split('|');
    return { source, target, weight, type: 'import' as const };
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
    ([dir, ids], i) => ({
      id: dir,
      label: dir,
      color: clusterColors[i % clusterColors.length],
      nodeIds: ids,
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
  if (!source.startsWith('.') && !source.startsWith('@/') && !source.startsWith('~/')) {
    return null;
  }

  let resolved = source;
  if (source.startsWith('@/')) {
    resolved = source.slice(2);
  } else if (source.startsWith('~/')) {
    resolved = source.slice(2);
  } else {
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

  // Interaction state
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showMinimap, setShowMinimap] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [nodeColors, setNodeColors] = useState<Record<FileType, string>>({ ...FILE_TYPE_COLORS });
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Set<EdgeType>>(new Set(['import', 'export', 'call']));

  const handleNodeColorChange = useCallback((fileType: FileType, color: string) => {
    setNodeColors((prev) => ({ ...prev, [fileType]: color }));
  }, []);

  const handleResetColors = useCallback(() => {
    setNodeColors({ ...FILE_TYPE_COLORS });
  }, []);

  const handleToggleEdgeType = useCallback((edgeType: EdgeType) => {
    setVisibleEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(edgeType)) next.delete(edgeType);
      else next.add(edgeType);
      return next;
    });
  }, []);

  // Hooks
  const { activeFilters, toggleFilter, resetFilters } = useGraphFilters();
  const { isOpen: searchOpen, close: closeSearch, highlightedNodeId, selectResult } = useSearch();

  // File contents for detail panel (from sessionStorage if local)
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let files: Map<string, string> | undefined;

        if (demo) {
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
          const raw = sessionStorage.getItem('anomaly:local-files');
          if (!raw) throw new Error('No local files found. Please go back and drop your folder again.');
          const entries: { path: string; content: string }[] = JSON.parse(raw);
          files = new Map(entries.map((e) => [e.path, e.content]));
          sessionStorage.removeItem('anomaly:local-files');
        } else if (repo) {
          const [owner, repoName] = repo.split('/');
          if (!owner || !repoName) throw new Error('Invalid repo format');
          const token = typeof window !== 'undefined'
            ? localStorage.getItem('anomaly:gh-token') ?? undefined
            : undefined;
          files = await loadFromGitHub(owner, repoName, token, (_loaded, total) => {
            if (!cancelled) setFileCount(total);
          });
        } else {
          throw new Error('No data source specified');
        }

        if (cancelled || !files) return;
        setFileCount(files.size);
        setFileContents(files);

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

  // Track mouse for tooltip
  useEffect(() => {
    const handler = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    console.log('[GraphPage] handleNodeClick called, node:', node?.label ?? 'null');
    if (!node || !node.id) {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
      console.log('[GraphPage] selectedNode set to:', node.label);
    }
  }, []);

  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    // For now, select the node — function sub-graph is a future enhancement
    setSelectedNode(node);
  }, []);

  const handleNavigate = useCallback((nodeId: string) => {
    if (!graphData) return;
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (node) setSelectedNode(node);
  }, [graphData]);

  // Zoom controls (dispatch custom events that ForceGraph can handle)
  const handleZoomIn = useCallback(() => {
    window.dispatchEvent(new CustomEvent('anomaly:zoom', { detail: { direction: 'in' } }));
  }, []);
  const handleZoomOut = useCallback(() => {
    window.dispatchEvent(new CustomEvent('anomaly:zoom', { detail: { direction: 'out' } }));
  }, []);
  const handleFitView = useCallback(() => {
    window.dispatchEvent(new CustomEvent('anomaly:zoom', { detail: { direction: 'fit' } }));
  }, []);

  if (error) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-[var(--color-bg)]">
        <p className="text-red-400">{error}</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="text-sm text-[var(--color-accent)] underline underline-offset-2">
          Back to home
        </a>
      </div>
    );
  }

  if (loading || !graphData) {
    return <LoadingGraph fileCount={fileCount} />;
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[var(--color-bg)]">
      {/* Canvas graph */}
      <ForceGraph
        data={graphData}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeHover={setHoveredNode}
        selectedNodeId={selectedNode?.id}
        filters={activeFilters}
        searchHighlight={highlightedNodeId}
        showLabels={showLabels}
        nodeColors={nodeColors}
        visibleEdgeTypes={visibleEdgeTypes}
      />

      {/* Filter bar */}
      <FilterBar
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onReset={resetFilters}
      />

      {/* Tooltip */}
      {hoveredNode && (
        <NodeTooltip node={hoveredNode} x={mousePos.x} y={mousePos.y} />
      )}

      {/* Detail panel */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          graphData={graphData}
          fileContent={fileContents.get(selectedNode.filePath)}
          onClose={() => setSelectedNode(null)}
          onNavigate={handleNavigate}
        />
      )}

      {/* Search overlay */}
      <SearchOverlay
        data={graphData}
        open={searchOpen}
        onClose={closeSearch}
        onSelect={selectResult}
      />

      {/* Minimap */}
      <Minimap
        nodes={graphData.nodes}
        viewportRect={{ x: 0, y: 0, width: 800, height: 600 }}
        bounds={{
          minX: Math.min(...graphData.nodes.map((n) => n.x ?? 0)),
          minY: Math.min(...graphData.nodes.map((n) => n.y ?? 0)),
          maxX: Math.max(...graphData.nodes.map((n) => n.x ?? 1000)),
          maxY: Math.max(...graphData.nodes.map((n) => n.y ?? 1000)),
        }}
        onNavigate={() => {}}
        visible={showMinimap}
      />

      {/* Legend */}
      <Legend
        nodeColors={nodeColors}
        onNodeColorChange={handleNodeColorChange}
        onResetColors={handleResetColors}
        visibleEdgeTypes={visibleEdgeTypes}
        onToggleEdgeType={handleToggleEdgeType}
      />

      {/* Graph controls */}
      <GraphControls
        nodeCount={graphData.nodes.length}
        edgeCount={graphData.edges.length}
        showMinimap={showMinimap}
        showLabels={showLabels}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
        onToggleLabels={() => setShowLabels((v) => !v)}
      />
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
