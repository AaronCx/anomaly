'use client';

/**
 * ClusterLabels — overlay for cluster name labels.
 *
 * NOTE: The actual cluster halos and labels are rendered directly on the
 * ForceGraph canvas for performance. This component exists as a placeholder
 * for any HTML-based cluster label overlays if needed in the future (e.g.,
 * interactive cluster controls). The canvas-based rendering in ForceGraph
 * handles:
 *   - Soft colored halo circles behind cluster groups (5-10% opacity)
 *   - Cluster name labels at centroid, visible only when zoomed out (k < 0.8)
 */

import type { Cluster, GraphNode } from '@/lib/graph/types';

interface ClusterLabelsProps {
  clusters: Cluster[];
  nodes: GraphNode[];
  transform: { x: number; y: number; k: number };
}

export default function ClusterLabels({ clusters, nodes, transform }: ClusterLabelsProps) {
  // Only show when zoomed out
  if (transform.k >= 0.8) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {clusters.map((cluster) => {
        const clusterNodes = nodes.filter((n) => cluster.nodeIds.includes(n.id));
        if (clusterNodes.length < 2) return null;

        const cx = clusterNodes.reduce((s, n) => s + (n.x ?? 0), 0) / clusterNodes.length;
        const cy = clusterNodes.reduce((s, n) => s + (n.y ?? 0), 0) / clusterNodes.length;

        const screenX = cx * transform.k + transform.x;
        const screenY = cy * transform.k + transform.y;

        return (
          <div
            key={cluster.id}
            className="absolute font-[var(--font-sans)] text-sm font-medium"
            style={{
              left: screenX,
              top: screenY,
              transform: 'translate(-50%, -50%)',
              color: cluster.color,
              opacity: 0.4,
            }}
          >
            {cluster.label}
          </div>
        );
      })}
    </div>
  );
}
