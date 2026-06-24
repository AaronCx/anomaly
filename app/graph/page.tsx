'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import LoadingGraph from '@/components/shared/LoadingGraph';
import ForceGraph from '@/components/graph/ForceGraph';
import NodeTooltip from '@/components/graph/NodeTooltip';
import DetailPanel from '@/components/graph/DetailPanel';
import SearchOverlay from '@/components/graph/SearchOverlay';
import FilterBar from '@/components/graph/FilterBar';
import GraphControls from '@/components/graph/GraphControls';
import Minimap from '@/components/graph/Minimap';
import Legend from '@/components/graph/Legend';
import { DriftPanel } from '@/components/graph/DriftPanel';
import { Timeline } from '@/components/graph/Timeline';
import { TracePanel } from '@/components/graph/TracePanel';
import { loadFromGitHub } from '@/lib/loader/github-loader';
import { buildGraph } from '@/lib/graph/graph-builder';
import { loadHistory } from '@/lib/history/snapshots';
import type { Snapshot } from '@/lib/history/types';
import type { GraphData, GraphNode, FileType, EdgeType } from '@/lib/graph/types';
import type { AgentTrace } from '@/lib/trace/types';
import { buildReplay, countResolved } from '@/lib/trace/replay';
import {
  History,
  Loader2,
  Route,
  Search,
  HelpCircle,
  Plus,
  X,
  MousePointerClick,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { DEFAULT_EDGE_COLORS } from '@/components/graph/Legend';
import { FILE_TYPE_COLORS } from '@/lib/constants';
import { useGraphFilters } from '@/hooks/useGraphFilters';
import { useSearch } from '@/hooks/useSearch';
import { cn } from '@/lib/utils';

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

  // History (git-timeline) mode — only available when a GitHub repo is loaded.
  const [historyMode, setHistoryMode] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [churn, setChurn] = useState<Map<string, number> | null>(null);
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sampleCount, setSampleCount] = useState(12);
  const [historyProgress, setHistoryProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });

  // Agent-trace overlay mode — replay an imported run on the graph.
  const [traceMode, setTraceMode] = useState(false);
  const [trace, setTrace] = useState<AgentTrace | null>(null);
  const [traceIndex, setTraceIndex] = useState(0);
  const [tracePlaying, setTracePlaying] = useState(false);

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

  // Minimap viewport (WORLD coords) — fed by ForceGraph's onViewportChange.
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Keyboard / interaction cheatsheet popover.
  const [showHelp, setShowHelp] = useState(false);

  // GitHub token-recovery affordance (shown on the error screen).
  const [tokenInput, setTokenInput] = useState('');

  // Hooks
  const { activeFilters, toggleFilter, resetFilters } = useGraphFilters();
  const { isOpen: searchOpen, open: openSearch, close: closeSearch, highlightedNodeId, selectResult } = useSearch();

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
    if (!node || !node.id) {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
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

  // Minimap click → recenter the canvas on the clicked WORLD point.
  const handleMinimapNavigate = useCallback((worldX: number, worldY: number) => {
    window.dispatchEvent(
      new CustomEvent('anomaly:panTo', { detail: { x: worldX, y: worldY } }),
    );
  }, []);

  // History mode is only meaningful for GitHub repos (we walk their commits).
  const historyAvailable = !!repo && !demo && local !== 'true';

  // Load the timeline: sample commits, build a graph per snapshot, compute churn.
  const loadTimeline = useCallback(async () => {
    if (!repo) return;
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) return;

    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryProgress({ loaded: 0, total: sampleCount });
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('anomaly:gh-token') ?? undefined
        : undefined;
      const { snapshots: snaps, churn: churnMap } = await loadHistory({
        owner,
        repo: repoName,
        token,
        sampleCount,
        onProgress: (p) =>
          setHistoryProgress({ loaded: p.snapshotsLoaded, total: p.totalSnapshots }),
      });
      const heat = new Map<string, number>();
      for (const [path, c] of churnMap) heat.set(path, c.heat);
      setSnapshots(snaps);
      setChurn(heat);
      setSnapshotIndex(snaps.length > 0 ? snaps.length - 1 : 0);
      setHistoryMode(true);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [repo, sampleCount]);

  const handleToggleHistory = useCallback(() => {
    if (historyMode) {
      // Turn off: revert to the single-snapshot view.
      setHistoryMode(false);
      setPlaying(false);
      return;
    }
    if (snapshots.length > 0) {
      setHistoryMode(true);
    } else {
      void loadTimeline();
    }
  }, [historyMode, snapshots.length, loadTimeline]);

  const handleScrub = useCallback((i: number) => {
    setSnapshotIndex(i);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  // ── Trace mode ──────────────────────────────────────────
  const handleToggleTrace = useCallback(() => {
    setTraceMode((on) => {
      const next = !on;
      // Leaving trace mode stops playback; the graph view returns to normal.
      if (!next) setTracePlaying(false);
      return next;
    });
  }, []);

  const handleLoadTrace = useCallback((next: AgentTrace | null) => {
    setTrace(next);
    setTraceIndex(0);
    setTracePlaying(false);
  }, []);

  const handleTraceScrub = useCallback((i: number) => setTraceIndex(i), []);
  const handleToggleTracePlay = useCallback(() => setTracePlaying((p) => !p), []);

  // The graph rendered: the active snapshot when in history mode, else the
  // normal single-snapshot graph. Default behaviour is unchanged when off.
  const activeGraph: GraphData | null =
    historyMode && snapshots.length > 0
      ? snapshots[Math.min(snapshotIndex, snapshots.length - 1)]?.graph ?? graphData
      : graphData;

  // Replay states for the loaded trace against the currently-rendered graph.
  // Deterministic + memoised, so scrubbing is O(1).
  const replayStates = useMemo(
    () => (traceMode && trace && activeGraph ? buildReplay(trace, activeGraph) : []),
    [traceMode, trace, activeGraph],
  );
  const traceResolvedCount = useMemo(
    () => (traceMode && trace && activeGraph ? countResolved(trace, activeGraph) : 0),
    [traceMode, trace, activeGraph],
  );
  const traceState =
    replayStates.length > 0
      ? replayStates[Math.min(traceIndex, replayStates.length - 1)]
      : null;

  // A human label for the loaded source, shown in the header cluster.
  const sourceLabel = useMemo(() => {
    if (repo) return repo;
    if (demo) return `demo · ${demo}`;
    if (local === 'true') return 'local folder';
    return 'graph';
  }, [repo, demo, local]);

  // A retry to a GitHub repo that just failed: it re-mounts the page so the
  // loader runs again, this time picking up any token the user just saved.
  const isGitHubSource = !!repo && !demo && local !== 'true';
  const handleSaveTokenAndRetry = useCallback(() => {
    const t = tokenInput.trim();
    if (typeof window !== 'undefined') {
      if (t) localStorage.setItem('anomaly:gh-token', t);
      window.location.reload();
    }
  }, [tokenInput]);

  // Close the help popover on Escape (window-level, like the other overlays).
  useEffect(() => {
    if (!showHelp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHelp(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHelp]);

  // A bottom-center scrubber (Timeline in history mode, or TracePanel in
  // trace mode) occupies the bottom band; when it does we lift the minimap
  // and keep the bottom-left GraphControls clear so they never overlap.
  const bottomBandActive =
    traceMode || (historyMode && snapshots.length > 0);

  // Minimap bounds — guarded against an empty nodes array (Math.min(...[])
  // is Infinity), which would otherwise produce a NaN/degenerate minimap.
  const minimapNodes = useMemo(() => graphData?.nodes ?? [], [graphData]);
  const minimapBounds = useMemo(() => {
    if (minimapNodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    }
    return {
      minX: Math.min(...minimapNodes.map((n) => n.x ?? 0)),
      minY: Math.min(...minimapNodes.map((n) => n.y ?? 0)),
      maxX: Math.max(...minimapNodes.map((n) => n.x ?? 1000)),
      maxY: Math.max(...minimapNodes.map((n) => n.y ?? 1000)),
    };
  }, [minimapNodes]);

  if (error) {
    return (
      <div className="app-backdrop flex h-dvh w-full items-center justify-center px-6">
        <div className="glass-strong animate-fade-in-up w-full max-w-md rounded-xl p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-danger)]" />
            <h1 className="text-sm font-semibold text-[var(--color-text)]">
              Couldn&apos;t load this graph
            </h1>
          </div>
          <div
            role="alert"
            className="mt-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]"
          >
            {error}
          </div>

          {isGitHubSource && (
            <div className="mt-4">
              <p className="text-xs text-[var(--color-text-muted)]">
                Private repo, rate limited, or not found? Add a GitHub personal
                access token to raise the limit and reach private repos.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_…"
                  aria-label="GitHub personal access token"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-[var(--font-mono)] text-sm outline-none transition placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
                />
                <button
                  type="button"
                  onClick={handleSaveTokenAndRetry}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg)] transition hover:bg-[var(--color-accent-bright)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
              </div>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=Anomaly"
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block text-xs text-[var(--color-accent)] underline-offset-2 transition hover:underline"
              >
                Create a token on GitHub →
              </a>
            </div>
          )}

          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)] transition hover:bg-white/[0.05] hover:text-[var(--color-text)]"
          >
            <ArrowLeft size={14} />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !graphData) {
    return <LoadingGraph fileCount={fileCount} />;
  }

  // No parseable source files: show an explicit empty state instead of a
  // blank graph (avoids a confusing "nothing happened" canvas).
  if (graphData.nodes.length === 0) {
    return (
      <div className="app-backdrop flex h-dvh w-full items-center justify-center px-6">
        <div className="glass-strong animate-fade-in-up w-full max-w-md rounded-xl p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)]/15">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)] shadow-[var(--shadow-glow)]" />
          </div>
          <h1 className="mt-4 text-base font-semibold text-[var(--color-text)]">
            No supported source files found
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Anomaly parses JS/TS, Python, and Java. This source had nothing it
            could build a dependency graph from.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg)] transition hover:bg-[var(--color-accent-bright)] active:scale-[0.98]"
          >
            <ArrowLeft size={14} />
            Try another source
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[var(--color-bg)]">
      {/* Canvas graph — swaps to the active snapshot in history mode */}
      <ForceGraph
        data={activeGraph ?? graphData}
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
        historyMode={historyMode}
        churn={churn}
        traceMode={traceMode}
        traceActiveId={traceState?.active ?? null}
        traceReadIds={traceState?.read ?? null}
        traceModifiedIds={traceState?.modified ?? null}
        traceDeletedIds={traceState?.deleted ?? null}
        tracePath={traceState?.path ?? null}
        onViewportChange={setViewport}
      />

      {/* ── Top-left: branding / source / new-analysis ─────────────── */}
      <div className="glass animate-fade-in absolute left-3 top-3 z-40 flex items-center gap-2.5 rounded-xl px-3 py-2 sm:left-4 sm:top-4">
        <Link
          href="/"
          aria-label="Anomaly — back to home"
          className="group flex items-center gap-2 rounded-lg outline-none"
        >
          <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
            <span className="absolute h-2.5 w-2.5 rounded-full bg-[var(--color-accent)] opacity-40 blur-[3px] transition group-hover:opacity-70" />
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[var(--shadow-glow)]" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
            Anomaly
          </span>
        </Link>
        <span className="h-4 w-px bg-[var(--color-border)]" />
        <span
          className="max-w-[42vw] truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)] sm:max-w-[220px]"
          title={sourceLabel}
        >
          {sourceLabel}
        </span>
        <span className="h-4 w-px bg-[var(--color-border)]" />
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95"
        >
          <Plus size={13} />
          <span className="hidden sm:inline">New analysis</span>
        </Link>
      </div>

      {/* ── Top-right: search + help ───────────────────────────────── */}
      <div className="absolute right-3 top-3 z-40 flex items-center gap-2 sm:right-4 sm:top-4">
        <div className="glass animate-fade-in flex items-center gap-1 rounded-xl px-1.5 py-1.5">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search the graph"
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95"
          >
            <Search size={15} />
            <span className="hidden text-xs sm:inline">Search</span>
            <kbd className="hidden rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-[var(--font-mono)] text-[10px] text-[var(--color-text-faint)] sm:inline">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label="Keyboard and interaction help"
            aria-expanded={showHelp}
            className={cn(
              'inline-flex items-center justify-center rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95',
              showHelp && 'bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)]',
            )}
          >
            <HelpCircle size={15} />
          </button>
        </div>

        {/* Interaction cheatsheet popover */}
        {showHelp && (
          <div
            role="dialog"
            aria-modal="false"
            aria-label="Keyboard and interaction shortcuts"
            className="glass-strong animate-fade-in-up absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                Shortcuts
              </h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                aria-label="Close help"
                className="inline-flex items-center justify-center rounded-lg p-1 text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95"
              >
                <X size={13} />
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-xs text-[var(--color-text-muted)]">
              {[
                ['Click', 'node details'],
                ['Drag node', 'reposition'],
                ['Scroll', 'zoom'],
                ['Drag canvas', 'pan'],
                ['⌘K', 'search'],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-3">
                  <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-[var(--font-mono)] text-[10px] text-[var(--color-text)]">
                    {k}
                  </kbd>
                  <span className="text-right">{v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 border-t border-[var(--color-border)] pt-2.5 text-[10px] text-[var(--color-text-faint)]">
              <MousePointerClick size={11} />
              Press Esc to dismiss
            </p>
          </div>
        )}
      </div>

      {/* Architecture drift panel (only when a .anomaly.yml was loaded).
          Pinned top-right, below the actions cluster. */}
      {graphData.drift && (
        <DriftPanel
          drift={graphData.drift}
          onSelectViolation={(v) => handleNavigate(v.source)}
          className="top-16 sm:top-[4.5rem]"
        />
      )}

      {/* ── Left tools column: History (GitHub only) + Trace ───────── */}
      <div className="absolute left-3 top-16 z-30 flex flex-col gap-2 sm:left-4 sm:top-[4.5rem]">
        {historyAvailable && (
          <div className="glass animate-fade-in flex items-center gap-2 rounded-xl px-2 py-1.5">
            <button
              type="button"
              onClick={handleToggleHistory}
              disabled={historyLoading}
              aria-label={historyMode ? 'Exit history mode' : 'Animate git history'}
              aria-pressed={historyMode}
              title={historyMode ? 'Exit history mode' : 'Animate git history'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95 disabled:pointer-events-none disabled:opacity-60',
                historyMode && 'bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)]',
              )}
            >
              {historyLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <History size={14} />
              )}
              History
            </button>
            {!historyMode && snapshots.length === 0 && (
              <label className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                <span>samples</span>
                <select
                  value={sampleCount}
                  onChange={(e) => setSampleCount(Number(e.target.value))}
                  disabled={historyLoading}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-[11px] text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)]"
                >
                  {[6, 12, 20, 30].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            {historyLoading && (
              <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
                {historyProgress.loaded}/{historyProgress.total}
              </span>
            )}
            {historyError && (
              <span
                role="alert"
                className="max-w-[180px] truncate text-[11px] text-[var(--color-danger)]"
                title={historyError}
              >
                {historyError}
              </span>
            )}
          </div>
        )}

        {/* Agent-trace overlay toggle (always available — works on any graph) */}
        <div className="glass animate-fade-in flex items-center gap-2 rounded-xl px-2 py-1.5">
          <button
            type="button"
            onClick={handleToggleTrace}
            aria-label={traceMode ? 'Exit trace mode' : 'Replay an agent run on the graph'}
            aria-pressed={traceMode}
            title={traceMode ? 'Exit trace mode' : 'Replay an agent run on the graph'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text)] active:scale-95',
              traceMode && 'bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)]',
            )}
          >
            <Route size={14} />
            Trace
          </button>
        </div>
      </div>

      {/* Trace overlay loader + step player (trace mode only) */}
      {traceMode && (
        <TracePanel
          trace={trace}
          states={replayStates}
          index={Math.min(traceIndex, Math.max(replayStates.length - 1, 0))}
          onIndexChange={handleTraceScrub}
          playing={tracePlaying}
          onTogglePlay={handleToggleTracePlay}
          onLoadTrace={handleLoadTrace}
          resolvedCount={traceResolvedCount}
        />
      )}

      {/* Timeline scrubber (history mode) */}
      {!traceMode && historyMode && snapshots.length > 0 && (
        <Timeline
          snapshots={snapshots}
          index={Math.min(snapshotIndex, snapshots.length - 1)}
          onIndexChange={handleScrub}
          playing={playing}
          onTogglePlay={handleTogglePlay}
        />
      )}

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

      {/* Minimap — viewport rect driven by ForceGraph (WORLD coords); click
          dispatches anomaly:panTo. Lifted above the bottom scrubber when one
          is visible so they never overlap. */}
      <Minimap
        nodes={minimapNodes}
        viewportRect={viewport}
        bounds={minimapBounds}
        onNavigate={handleMinimapNavigate}
        visible={showMinimap}
        className={bottomBandActive ? 'bottom-28 sm:bottom-32' : undefined}
      />

      {/* Legend — stacked under the top-right actions; pushed further down
          when the DriftPanel occupies the upper-right corner. */}
      <Legend
        nodeColors={nodeColors}
        onNodeColorChange={handleNodeColorChange}
        edgeColors={edgeColors}
        onEdgeColorChange={handleEdgeColorChange}
        onResetColors={handleResetColors}
        visibleEdgeTypes={visibleEdgeTypes}
        onToggleEdgeType={handleToggleEdgeType}
        className={graphData.drift ? 'top-44 sm:top-52' : 'top-16 sm:top-20'}
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
