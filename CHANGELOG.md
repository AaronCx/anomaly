# Changelog

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
