# Anomaly — Codebase X-Ray & Visual Intelligence Platform

> Point it at any repo. See how the whole thing works in 30 seconds.

A standalone web application that takes any GitHub repo URL, parses its structure using AST analysis, and renders interactive visualizations showing how every function, route, module, and data flow connects. Each node is annotated by an LLM with a one-line plain-English summary.

**This is not a linter. This is not a code reviewer. This is a visual understanding tool.**

## Try It Live

**[anomaly-eta.vercel.app](https://anomaly-eta.vercel.app)**

Demo repos pre-loaded: AgentForge, LastGate, Express.js, FastAPI

## What It Does

### Route Tracer
Enter an API route path, see every function that executes as a horizontal swimlane diagram. Color-coded by layer: routes (blue), middleware (cyan), services (amber), data access (purple).

### Module Map
Bird's-eye force-directed graph of every file and import relationship. Nodes sized by complexity, colored by type, clustered by community detection. Click any file to drill into its function graph.

### Call Graph
Hierarchical view of function-to-function calls with dagre layout. Dead code detection flags unreachable functions. Depth slider (1-5 levels). Click two functions to see the shortest call path.

### AI Annotations
Every node in every view annotated with a one-line plain-English summary via GPT-4o-mini. Loading shimmer while generating. Refresh to regenerate.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS | Consistent with portfolio stack |
| Visualization | React Flow + D3.js | React Flow for node graphs, D3 for force-directed layout |
| AST Parsing | @babel/parser + @babel/traverse | Full JS/TS/JSX/TSX support in Node.js |
| AI Annotations | OpenAI GPT-4o-mini | Cost-efficient per-function summaries |
| GitHub Integration | GitHub REST API | Public repos, no auth needed |
| Deployment | Vercel | Free tier compatible |

## Architecture

```
GitHub Repo URL
      |
      v
GitHub REST API --> File Tree + Contents
      |
      v
@babel/parser --> AST per file
      |
      v
Extractors --> imports, exports, functions, calls, routes
      |
      v
Graph Builders --> Module Graph | Call Graph | Route Trace
      |
      v
React Flow / D3.js --> Interactive Visualization
      |
      v
OpenAI GPT-4o-mini --> AI Annotations (async)
```

### Key Architecture Decisions

- **No Python backend**: Everything runs in Next.js API routes. Eliminates separate backend deployment, keeps the entire app on Vercel free tier.
- **In-memory caching**: Analysis results are ephemeral (cleared on cold start). Trade-off: repeat analyses re-parse, but avoids database dependency.
- **GitHub API over git clone**: Fetches files via REST instead of cloning. Works on Vercel serverless. Trade-off: rate limited to 60 req/hr unauthenticated (set `GITHUB_TOKEN` for 5000/hr).
- **Babel over tree-sitter**: tree-sitter requires native binaries complex to deploy on Vercel. Babel handles JS/TS/JSX/TSX natively. Trade-off: no Python/Java/Go parsing yet.

## Supported Languages & Frameworks

| Language | Parsing | Route Detection |
|----------|---------|----------------|
| JavaScript/TypeScript | Full AST | Express, Fastify, Hono |
| JSX/TSX | Full AST | Next.js App Router, Pages API |
| Python | Planned | FastAPI, Flask, Django |
| Java | Planned | Spring Boot |
| Go | Planned | net/http, Gin |

## Local Development

```bash
git clone https://github.com/AaronCx/anomaly.git
cd anomaly
bun install
cp .env.example .env.local
bun dev
```

Optional env vars:
- `OPENAI_API_KEY` — enables AI annotations
- `GITHUB_TOKEN` — higher GitHub API rate limits

## Roadmap

- [ ] Python parser support via tree-sitter WASM
- [ ] Java/Go parser support
- [ ] Private repo support (GitHub OAuth)
- [ ] VS Code extension
- [ ] Diff visualization between commits
- [ ] Persistent caching (Redis/Vercel KV)

## License

MIT
