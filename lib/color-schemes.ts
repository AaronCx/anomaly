import { NodeLayer, FileType } from './types'

export const LAYER_COLORS: Record<NodeLayer, string> = {
  route: '#3b82f6',       // Electric blue
  middleware: '#06b6d4',   // Cyan
  controller: '#06b6d4',  // Cyan
  service: '#f59e0b',     // Amber
  data: '#8b5cf6',        // Purple
  utility: '#6b7280',     // Neutral gray
  test: '#f97316',        // Orange
  config: '#4b5563',      // Dimmed gray
  component: '#10b981',   // Green
  unknown: '#6b7280',     // Neutral gray
}

export const FILE_TYPE_COLORS: Record<FileType, string> = {
  route: '#3b82f6',
  component: '#10b981',
  utility: '#6b7280',
  test: '#f97316',
  config: '#4b5563',
  model: '#8b5cf6',
  service: '#f59e0b',
  middleware: '#06b6d4',
  unknown: '#6b7280',
}

export const DEAD_CODE_COLOR = '#ef4444'
export const DEAD_CODE_OPACITY = 0.4

export const BG_COLOR = '#0a0a0f'
export const CARD_BG = '#151520'
export const CARD_BORDER = '#1e1e2e'
export const TEXT_PRIMARY = '#e2e8f0'
export const TEXT_DIM = '#64748b'
export const ACCENT = '#3b82f6'

export function getLayerColor(layer: NodeLayer): string {
  return LAYER_COLORS[layer] || LAYER_COLORS.unknown
}

export function getFileTypeColor(type: FileType): string {
  return FILE_TYPE_COLORS[type] || FILE_TYPE_COLORS.unknown
}

export function getEdgeColor(targetLayer: NodeLayer): string {
  return getLayerColor(targetLayer) + '80' // 50% opacity
}
