import type { FunctionDef } from '@/lib/parser/types';

export interface GraphNode {
  id: string;
  filePath: string;
  label: string;
  fileType: FileType;
  loc: number;
  complexity: number;
  imports: string[];
  exports: string[];
  functions: FunctionDef[];
  annotation?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  radius?: number;
}

export type EdgeType = 'import' | 'export' | 'call';

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: EdgeType;
  /** Set when this dependency violates a declared architecture rule. */
  violation?: import('@/lib/rules/types').Violation;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
  /** Architecture drift report, present when a .anomaly.yml was supplied. */
  drift?: import('@/lib/rules/types').DriftReport;
}

export interface Cluster {
  id: string;
  label: string;
  color: string;
  nodeIds: string[];
}

export type FileType =
  | 'component'
  | 'route'
  | 'service'
  | 'utility'
  | 'model'
  | 'test'
  | 'config'
  | 'unknown';
