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

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
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
