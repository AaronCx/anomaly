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
import { loadFromGitHub } from '@/lib/loader/github-loader';
import { buildGraph } from '@/lib/graph/graph-builder';
import type { GraphData, GraphNode, FileType, EdgeType } from '@/lib/graph/types';
import { DEFAULT_EDGE_COLORS } from '@/components/graph/Legend';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { useGraphFilters } from '@/hooks/useGraphFilters';
import { useSearch } from '@/hooks/useSearch';

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
  const [edgeColors, setEdgeColors] = useState<Record<EdgeType, string>>({ ...DEFAULT_EDGE_COLORS });
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Set<EdgeType>>(new Set(['import', 'export', 'call']));

  const handleNodeColorChange = useCallback((fileType: FileType, color: string) => {
    setNodeColors((prev) => ({ ...prev, [fileType]: color }));
  }, []);

  const handleEdgeColorChange = useCallback((edgeType: EdgeType, color: string) => {
    setEdgeColors((prev) => ({ ...prev, [edgeType]: color }));
  }, []);

  const handleResetColors = useCallback(() => {
    setNodeColors({ ...FILE_TYPE_COLORS });
    setEdgeColors({ ...DEFAULT_EDGE_COLORS });
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

        const data = buildGraph(files);
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
        edgeColors={edgeColors}
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
        edgeColors={edgeColors}
        onEdgeColorChange={handleEdgeColorChange}
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
