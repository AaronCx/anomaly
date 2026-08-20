# Changelog

## [2.1.0] - 2026-08-19

Version identity catches up with the app: `package.json` moves 0.1.0 → 2.1.0 to
match the release line, and this entry collects everything shipped since the
2.0.0 browser-only rewrite.

### Added
- Architecture rules + drift detection: declare intended layers and forbidden
  imports in a `.anomaly.yml`; violations render as red edges and the
  Architecture panel shows a drift score with a clickable violation list (#2)
- Git-history time dimension: a timeline scrubber samples a GitHub repo's
  commit history, parses the codebase at each sampled commit, and animates the
  graph's evolution with churn heat glowing on frequently-changed files (#3)
- Agent-trace overlay: import a Forge run log, a Claude Code session, or a
  canonical JSON trace and replay the agent's run on the graph — files read,
  modified, created, and deleted, in order, with the traversal path drawn (#4)
- CI now runs the test suite (previously build + lint only, which is how test
  breakage hid) (#17)
- MIT LICENSE file and repository metadata in `package.json` (#24)

### Changed
- Complete UI overhaul to the Refined Obsidian design system: Tailwind v4
  design tokens (surface ramp, accent, file-type palette, motion), rebuilt
  landing page, and every graph panel unified on one glass material and
  control recipe (#17)
- Graph readability at scale: directory clusters lay out as distinct lobes on
  a ring, hubs are sized and labeled by connection count, hover/select lights
  the focused neighbourhood and dims the rest, and signal pulses travel along
  active connections (#18)
- Graph-physics hardening: charge and collision now scale with edge density,
  export edges are excluded from the simulation, and the view auto-fits after
  the simulation settles — dense graphs spread out evenly instead of bunching
- Dependency maintenance: Dependabot version updates enabled (#5), `next`
  upgraded to 16.2.9 for a Dependabot alert (#14), frontend dependency group
  upgraded (react, lucide-react 1.x, babel 8, typescript 6) (#19), GitHub
  Actions bumped (#6, #16)

### Fixed
- June security audit: `next`/`eslint-config-next` bumped past HIGH advisories,
  and `parseRepoUrl` now strips a trailing `.git` from pasted GitHub URLs (#1)
- 8 failing tests fixed (suite now green), dead `anomaly` demo fetch, dead zoom
  buttons, no-op minimap replaced with a live world-space lens, DetailPanel
  duplicate-key crash, `useSearch` timer leak, and all lint warnings (#17)

## [2.0.0] - 2026-03-16

### Changed
- Complete architecture rewrite: everything now runs in the browser (zero backend)
- Visualization moved from React Flow/SVG to D3 force simulation on HTML5 Canvas
- Visual style changed from "Mission Control" to Obsidian graph view aesthetic
- AI annotations now optional — user provides their own OpenAI key in the browser

### Added
- Drag-and-drop folder loading via File System Access API (works offline)
- GitHub URL loading via REST API from the browser
- D3 force simulation with physics-based node layout
- Canvas rendering with radial gradient glow nodes
- Quadratic bezier curved edges with opacity-based connection strength
- Semantic zoom — labels appear at close range, clusters at distance
- Node hover interactions with glow, tooltip, and edge highlighting
- Click-to-open detail panel with file info and source code
- Double-click to zoom into function-level sub-graph
- Cmd+K fuzzy search across files, functions, and exports
- File type filter toggles (Components, Routes, Services, Utils, Tests, Config)
- Minimap overview with click-to-navigate
- Cluster detection with soft halo rendering
- Graph controls (zoom, fit, toggle minimap/labels)
- Regex-based Python file parser
- Regex-based Java file parser
- Pre-parsed demo repos (Anomaly, AgentForge, LastGate)
- Demo data generation script

### Removed
- Server-side API routes (replaced by client-side processing)
- React Flow dependency (replaced by D3 canvas)
- dagre dependency (replaced by D3 force layout)
- openai server dependency (user provides key client-side)
- In-memory server store (no server needed)

## [1.0.0] - 2026-03-16

### Added
- Initial release with server-side parsing pipeline
- Route Tracer, Module Map, Call Graph visualization modes
- AST parsing via @babel/parser
- Vercel deployment with API routes
