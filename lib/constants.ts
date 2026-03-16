import type { FileType } from '@/lib/graph/types';

/* ── Obsidian palette ─────────────────────────────────── */

export const COLORS = {
  bg: '#0b0b0f',
  surface: '#12121a',
  border: '#1e1e2e',
  text: '#e4e4ef',
  textMuted: '#8888a0',
  accent: '#60a5fa',
  selected: '#ffffff',
  edgeDefault: 'rgba(255, 255, 255, 0.15)',
  edgeHover: 'rgba(255, 255, 255, 0.40)',
} as const;

export const FILE_TYPE_COLORS: Record<FileType, string> = {
  component: '#60a5fa',
  route: '#22d3ee',
  service: '#fbbf24',
  utility: '#9ca3af',
  model: '#a78bfa',
  test: '#fb923c',
  config: '#4b5563',
  unknown: '#6b7280',
};

/* ── Physics / force simulation ───────────────────────── */

export const PHYSICS = {
  charge: -150,
  linkDistance: 80,
  collisionPadding: 5,
  alphaDecay: 0.03,    // Faster cooldown — graph settles in ~3 seconds
  velocityDecay: 0.5,  // More damping — nodes don't drift as much
  centerStrength: 0.05,
} as const;

/* ── Node sizing ──────────────────────────────────────── */

export const NODE = {
  minRadius: 4,
  maxRadius: 20,
  labelThreshold: 0.6, // zoom level at which labels appear
} as const;

/* ── Demo repos available on the landing page ─────────── */

export const DEMOS = [
  { name: 'anomaly', label: 'Anomaly' },
  { name: 'agentforge', label: 'AgentForge' },
  { name: 'lastgate', label: 'LastGate' },
] as const;
