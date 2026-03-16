import type { Cluster, GraphNode } from '@/lib/graph/types';

/**
 * Palette for cluster colors — distinct hues at moderate saturation.
 */
const CLUSTER_PALETTE = [
  '#60a5fa', // blue
  '#34d399', // green
  '#fbbf24', // amber
  '#f472b6', // pink
  '#a78bfa', // purple
  '#fb923c', // orange
  '#22d3ee', // cyan
  '#f87171', // red
  '#4ade80', // lime
  '#e879f9', // fuchsia
];

/**
 * Extract the directory group for a file path.
 * Uses the first two path segments as the cluster key.
 * e.g. "lib/parser/index.ts" → "lib/parser"
 *      "app/page.tsx" → "app"
 */
function getDirectoryGroup(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length >= 3) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts.length >= 2) {
    return parts[0];
  }
  return '<root>';
}

/**
 * Simple community detection by grouping files by their top-level directory.
 * Assigns a color from the palette to each cluster.
 */
export function detectClusters(nodes: GraphNode[]): Cluster[] {
  const groups = new Map<string, string[]>();

  for (const node of nodes) {
    const group = getDirectoryGroup(node.filePath);
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(node.id);
  }

  const clusters: Cluster[] = [];
  let colorIdx = 0;

  for (const [dir, nodeIds] of groups) {
    clusters.push({
      id: dir,
      label: dir,
      color: CLUSTER_PALETTE[colorIdx % CLUSTER_PALETTE.length],
      nodeIds,
    });
    colorIdx++;
  }

  return clusters;
}
