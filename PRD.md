# PRD.md — CodeScope VS Code Extension

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-09-03  

---

## 1. Executive Summary

**CodeScope** is a VS Code extension that gives developers a living, intelligent map of their codebase. It analyzes project structure, detects code health issues, surfaces dependency risks, and — eventually — answers natural language questions about the project using AI.

The core insight: **most developer tools operate on individual files. CodeScope operates on the entire project as a graph.**

---

## 2. Problem Statement

Developers working on medium-to-large codebases face:

- **Lost in the codebase** — hard to understand how modules relate to each other.
- **Hidden technical debt** — dead code, unused dependencies, and performance anti-patterns accumulate silently.
- **Dependency blindness** — no easy way to see what depends on what, or what breaks if something changes.
- **Context switching cost** — jumping between files to understand a flow is slow and error-prone.

Existing tools (linters, bundlers, IDEs) solve parts of this. None give a **unified, project-level intelligence layer** inside VS Code.

---

## 3. Vision

> CodeScope is the developer's second brain — it knows your codebase so you don't have to memorize it.

**Long-term north star:**  
A developer can open any project and within 30 seconds understand:
- What it does architecturally
- Where the risks are
- What's safe to delete
- What's slow and why

---

## 4. Target Users

| User | Pain |
|------|------|
| Mid-senior engineers joining a new codebase | Onboarding takes weeks |
| Lead engineers / architects | Hard to enforce code quality at scale |
| Solo developers on side projects | Easy to accumulate debt without noticing |
| Teams doing large refactors | Fear of breaking unknown dependencies |

---

## 5. Feature Modules

### Module 1 — Codebase Explorer 🗺️
Provides a visual, navigable map of the project: files, classes, functions, imports, exports, and call relationships.

**Key capabilities:**
- Sidebar tree of project structure
- Click any function → see where it's defined, what it calls, what calls it
- Dependency graph visualization (webview)
- Search across the codebase index

### Module 2 — Dead Code Hunter 🧹
Finds code that exists but is never used.

**Key capabilities:**
- Unused functions (0 inbound references)
- Unused exports (no external consumers)
- Unused files (not imported anywhere)
- Unused npm dependencies
- Actions: Open | Ignore | Mark for deletion

### Module 3 — Dependency Detective 📦
Analyzes `package.json` and the import graph to surface dependency risks.

**Key capabilities:**
- Dependency tree visualization
- "Used by N files" counts per package
- Outdated package detection (npm registry)
- Vulnerable package flagging (future: npm audit integration)
- Circular dependency detection

### Module 4 — Performance Analyzer ⚡
Static analysis for common JS/TS performance anti-patterns.

**Key capabilities:**
- Await inside loops (N+1 pattern)
- Nested loops with complexity warnings
- Synchronous blocking calls in async contexts
- Repeated expensive function invocations
- Each warning labeled: HIGH / MEDIUM / LOW
- Actions: Show Code | Explain | Fix (AI-assisted)

### Module 5 — Debug Variable Tracker 🐛
Tracks how a variable's value changes across debug sessions.

**Key capabilities:**
- Select any variable → track its value through execution
- Timeline view of value changes per line
- Highlight the line where an unexpected change occurred
- Requires VS Code Debug Adapter Protocol integration

### Module 6 — AI Assistant 🤖 *(Phase 8)*
Natural language interface over the structured codebase index.

**Key capabilities:**
- "What calls `getUserById`?"
- "What would break if I delete `AuthService`?"
- "Why is this endpoint potentially slow?"
- "Explain how authentication works in this project."
- Context is structured (graph + AST), not raw file text

---

## 6. Architecture Overview

```
codescope/
│
├── src/
│   ├── extension.ts              # Activate / deactivate
│   │
│   ├── core/                     # Shared foundation — no VS Code UI deps
│   │   ├── types/
│   │   │   ├── CodeEntity.ts     # Function, Class, File, Variable entities
│   │   │   ├── Dependency.ts     # Edges in the dependency graph
│   │   │   └── AnalysisResult.ts # Shared result shape
│   │   ├── errors/
│   │   │   └── CodeScopeError.ts # Structured error types
│   │   ├── logger.ts             # Logging service (wraps VS Code output channel)
│   │   └── registry.ts           # Central service locator / DI container
│   │
│   ├── commands/                  # VS Code command handlers
│   │   ├── analyzeProject.ts
│   │   ├── analyzeFile.ts
│   │   └── scanDependencies.ts
│   │
│   ├── analyzer/                  # Pure analysis engines — no VS Code UI
│   │   ├── codebase/
│   │   │   ├── projectScanner.ts  # Walk workspace files
│   │   │   ├── fileIndexer.ts     # AST → CodeEntity[]
│   │   │   └── dependencyGraph.ts # Build the graph from index
│   │   ├── deadcode/
│   │   │   └── deadCodeAnalyzer.ts
│   │   ├── dependencies/
│   │   │   └── dependencyAnalyzer.ts
│   │   ├── performance/
│   │   │   ├── performanceAnalyzer.ts
│   │   │   └── rules/             # Individual static analysis rules
│   │   └── debugger/
│   │       └── variableTracker.ts
│   │
│   ├── providers/                 # VS Code UI providers
│   │   ├── SidebarProvider.ts     # WebviewViewProvider for the main panel
│   │   └── CodebaseTreeProvider.ts # TreeDataProvider for explorer
│   │
│   ├── webview/                   # React UI for webview panels
│   │   ├── dashboard/
│   │   └── graph/
│   │
│   └── ai/
│       ├── contextBuilder.ts
│       └── assistant.ts
│
├── package.json
├── tsconfig.json
├── webpack.config.js
├── .eslintrc.json
├── PRD.md
├── AGENT.md
└── README.md
```

### Architectural Laws

1. **`core/` is the only shared layer.** All other layers import from `core/`, never from each other's internals.
2. **`analyzer/` has zero VS Code UI dependencies.** It receives plain data and returns plain data. This makes it testable in isolation.
3. **`providers/` orchestrates** — it calls analyzers and feeds results to the webview/treeview.
4. **`commands/` is thin** — just parses VS Code context and delegates to analyzers or providers.
5. **`webview/` communicates only via message passing** (`postMessage` / `onDidReceiveMessage`). No direct VS Code API calls inside React components.

### The Codebase Graph (Core Concept)

The graph is the foundation of CodeScope. Every feature is a query against this graph.

```typescript
interface CodeEntity {
  id: string;                        // Unique: "file::function::name"
  name: string;
  kind: 'file' | 'class' | 'function' | 'variable' | 'export';
  filePath: string;
  startLine: number;
  endLine: number;
}

interface DependencyEdge {
  from: string;                      // CodeEntity.id
  to: string;                        // CodeEntity.id
  kind: 'import' | 'call' | 'extends' | 'implements' | 'reference';
}

interface CodebaseGraph {
  entities: Map<string, CodeEntity>;
  edges: DependencyEdge[];
}
```

---

## 7. Phased Delivery Plan

### Phase 1 — Extension Skeleton ✅ CURRENT
**Goal:** Working VS Code extension that loads, shows a sidebar, and runs a command.

Deliverables:
- `package.json` with all contribution points declared
- `extension.ts` with clean activate/deactivate
- `SidebarProvider.ts` with basic webview (HTML placeholder)
- `Logger` service
- `Registry` service (empty DI container)
- Command: `codescope.analyzeProject` → shows progress notification
- TypeScript builds with zero errors
- Extension loads in Extension Development Host

### Phase 2 — Project Scanner + AST Index
**Goal:** CodeScope can walk a workspace and build a `CodebaseGraph` in memory.

Deliverables:
- `projectScanner.ts` — file walker, respects `.gitignore`
- `fileIndexer.ts` — TypeScript Compiler API → `CodeEntity[]`
- `dependencyGraph.ts` — assembles edges from import/export analysis
- Progress reporting during scan
- Results stored in extension memory (no persistence yet)

### Phase 3 — Codebase Explorer
**Goal:** First interactive UI feature. Sidebar tree + function detail panel.

Deliverables:
- `CodebaseTreeProvider.ts` — TreeView of files/classes/functions
- Click → open file at line
- Webview panel: "What calls this?" / "What does this call?"

### Phase 4 — Dead Code Hunter
**Goal:** Detect and surface unused code.

Deliverables:
- `deadCodeAnalyzer.ts` — queries graph for 0-reference entities
- Sidebar section: Dead Code list
- Actions: Open | Ignore | Delete

### Phase 5 — Dependency Detective
**Goal:** Analyze npm dependencies and the import graph.

Deliverables:
- `dependencyAnalyzer.ts` — reads `package.json`, maps import usage
- Dependency tree webview
- "N files depend on this package" badges
- Outdated package detection (npm registry HTTP call)

### Phase 6 — Performance Analyzer
**Goal:** Static analysis for JS/TS performance anti-patterns.

Deliverables:
- Rule engine in `analyzer/performance/rules/`
- Initial rules: await-in-loop, nested-loops, sync-in-async
- Results shown with HIGH/MEDIUM/LOW severity
- CodeLens annotations on flagged lines

### Phase 7 — Debug Variable Tracker
**Goal:** Track variable values during live debug sessions.

Deliverables:
- `variableTracker.ts` using VS Code Debug Adapter Protocol
- Variable selection via context menu
- Timeline webview of value changes

### Phase 8 — AI Assistant
**Goal:** Natural language queries over the structured codebase index.

Deliverables:
- `contextBuilder.ts` — serializes relevant graph subsets for LLM context
- `assistant.ts` — wraps LLM API (configurable: OpenAI, Gemini, local)
- Chat-style webview panel
- Suggested questions based on current context

### Phase 9 — Dashboard & Polish
**Goal:** Unified project health score and polished UI.

Deliverables:
- Project Health Score (0–100, computed from all analyzer results)
- Main dashboard webview with all module entry points
- VS Code Marketplace listing preparation

---

## 8. Non-Goals (explicitly out of scope)

- CodeScope will NOT auto-delete or auto-refactor code without explicit user action.
- CodeScope will NOT upload user code to external servers (except for AI feature, which is opt-in and configurable).
- CodeScope will NOT replace a linter or type checker — it complements them.
- CodeScope will NOT support non-JS/TS languages in Phase 1–4 (future: Python, Go, Rust support via LSP).

---

## 9. Success Metrics

| Metric | Phase 1 Target | Phase 5 Target | Phase 9 Target |
|--------|---------------|----------------|----------------|
| Extension load time | < 200ms | < 300ms | < 500ms |
| Project scan time (1k files) | N/A | < 10s | < 8s |
| TypeScript compile errors | 0 | 0 | 0 |
| VS Code Marketplace rating | N/A | N/A | ≥ 4.5★ |

---

## 10. Open Questions

- [ ] **AI provider strategy** — support multiple LLMs (OpenAI, Gemini, Ollama) or pick one for Phase 8?
- [ ] **Persistence** — store the codebase index on disk (`.vscode/codescope/`) or rebuild each session?
- [ ] **Multi-root workspaces** — support in Phase 2 or defer?
- [ ] **Language support** — TypeScript/JavaScript only for MVP, or include Python via tree-sitter?
- [ ] **Extension name** — "CodeScope" confirmed? Will affect Marketplace ID.

---

## 11. Design Principles

1. **Fast** — Never block the extension host. Everything async.
2. **Honest** — Phrase static analysis findings as "potential issues", never absolute facts.
3. **Non-destructive** — Never modify user code without explicit, confirmed user action.
4. **Incremental** — Each phase ships a usable product, not just infrastructure.
5. **Typed** — Strict TypeScript throughout. The codebase models its own domain with precision.
