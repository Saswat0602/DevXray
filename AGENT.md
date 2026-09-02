# AGENT.md — CodeScope Development Agent Guide

**Version:** 1.0  
**Status:** Living Document  
**Purpose:** Everything a new developer (or AI agent) needs to understand and contribute to CodeScope correctly.

---

## 1. What Is CodeScope?

CodeScope is a **VS Code extension** that builds an intelligent graph of a TypeScript/JavaScript codebase and surfaces:

- 🗺️ Codebase structure and relationships
- 🧹 Dead / unused code
- 📦 Dependency risks
- ⚡ Performance anti-patterns
- 🐛 Variable tracking during debug sessions
- 🤖 AI-assisted questions about the project

**The graph is the product.** Every feature is a view or query over a shared `CodebaseGraph` data structure. If you are adding a feature, you are either (a) improving the graph, or (b) querying the graph in a new way.

---

## 2. Repository Layout

```
codescope/
├── src/
│   ├── extension.ts              # Entry point: activate() / deactivate()
│   ├── core/
│   │   ├── types/
│   │   │   ├── CodeEntity.ts     # Core domain types
│   │   │   ├── Dependency.ts
│   │   │   └── AnalysisResult.ts
│   │   ├── errors/
│   │   │   └── CodeScopeError.ts
│   │   ├── logger.ts
│   │   └── registry.ts           # Service registry / DI
│   ├── commands/
│   │   ├── analyzeProject.ts
│   │   ├── analyzeFile.ts
│   │   └── scanDependencies.ts
│   ├── analyzer/
│   │   ├── codebase/
│   │   │   ├── projectScanner.ts
│   │   │   ├── fileIndexer.ts
│   │   │   └── dependencyGraph.ts
│   │   ├── deadcode/
│   │   │   └── deadCodeAnalyzer.ts
│   │   ├── dependencies/
│   │   │   └── dependencyAnalyzer.ts
│   │   ├── performance/
│   │   │   ├── performanceAnalyzer.ts
│   │   │   └── rules/
│   │   └── debugger/
│   │       └── variableTracker.ts
│   ├── providers/
│   │   ├── SidebarProvider.ts
│   │   └── CodebaseTreeProvider.ts
│   ├── webview/
│   │   ├── dashboard/
│   │   └── graph/
│   └── ai/
│       ├── contextBuilder.ts
│       └── assistant.ts
├── package.json
├── tsconfig.json
├── webpack.config.js
├── .eslintrc.json
├── PRD.md
├── AGENT.md
└── README.md
```

---

## 3. Architectural Laws — READ BEFORE WRITING ANY CODE

These are non-negotiable constraints. Every PR must comply.

### Law 1: Layer Dependency Direction

```
commands/ → providers/ → analyzer/ → core/
                           ↑
                      (no upward deps)
```

- `core/` imports **nothing** from this project.
- `analyzer/` imports **only** from `core/`.
- `providers/` imports from `core/` and `analyzer/`.
- `commands/` imports from `core/`, `analyzer/`, and `providers/`.
- `webview/` (React) imports **nothing** from `core/` — communicates only via `postMessage`.

### Law 2: analyzer/ is VS Code–free

No file inside `src/analyzer/` may import from `vscode`. This keeps analyzers unit-testable as plain Node.js code.

✅ OK inside analyzer:
```typescript
import { CodeEntity } from '../core/types/CodeEntity';
```

❌ Never inside analyzer:
```typescript
import * as vscode from 'vscode';
```

### Law 3: Never modify user code silently

Any action that changes a file in the workspace **must**:
1. Show a confirmation dialog (use `vscode.window.showWarningMessage` with buttons).
2. Log the action via the `Logger` service.
3. Be reversible if at all possible.

### Law 4: TypeScript strictness

`tsconfig.json` always has:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

**Zero TypeScript errors is a hard gate.** Never use `any` — use `unknown` with a type guard instead.

### Law 5: No `console.log` in production code

Use the `Logger` service (`src/core/logger.ts`) which wraps the VS Code Output Channel.

```typescript
// ✅ Correct
Logger.info('ProjectScanner', 'Scan started', { fileCount: 42 });

// ❌ Never
console.log('scan started');
```

---

## 4. Core Domain Types

These are sacred. Do not change them without updating every consumer.

### `CodeEntity`

```typescript
// src/core/types/CodeEntity.ts
export type CodeEntityKind = 'file' | 'class' | 'function' | 'variable' | 'export' | 'interface' | 'type';

export interface CodeEntity {
  readonly id: string;          // Unique: `${filePath}::${kind}::${name}`
  readonly name: string;
  readonly kind: CodeEntityKind;
  readonly filePath: string;    // Absolute path
  readonly startLine: number;   // 1-indexed
  readonly endLine: number;     // 1-indexed
  readonly isExported: boolean;
}
```

### `DependencyEdge`

```typescript
// src/core/types/Dependency.ts
export type DependencyKind = 'import' | 'call' | 'extends' | 'implements' | 'reference';

export interface DependencyEdge {
  readonly from: string;         // CodeEntity.id
  readonly to: string;           // CodeEntity.id
  readonly kind: DependencyKind;
  readonly filePath: string;     // File where this edge originates
  readonly line: number;
}
```

### `CodebaseGraph`

```typescript
export interface CodebaseGraph {
  readonly entities: ReadonlyMap<string, CodeEntity>;
  readonly edges: ReadonlyArray<DependencyEdge>;
  readonly scannedAt: Date;
}
```

### `AnalysisResult<T>`

```typescript
// src/core/types/AnalysisResult.ts
export interface AnalysisResult<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: CodeScopeError;
}

export function ok<T>(data: T): AnalysisResult<T> {
  return { ok: true, data };
}

export function err<T>(error: CodeScopeError): AnalysisResult<T> {
  return { ok: false, error };
}
```

---

## 5. Service Registry

`src/core/registry.ts` is a simple typed service locator. Instantiate services once in `extension.ts` and register them here.

```typescript
// Usage
const scanner = Registry.get(ProjectScanner);
```

All services must be registered before any command is invoked.

---

## 6. Webview Communication Protocol

The webview (React) and the extension host communicate exclusively via messages. The message shape is:

```typescript
// Shared type (in core/types/WebviewMessage.ts)
export type ExtensionToWebviewMessage =
  | { type: 'GRAPH_UPDATED'; payload: SerializedCodebaseGraph }
  | { type: 'ANALYSIS_RESULT'; payload: PerformanceIssue[] }
  | { type: 'SCAN_PROGRESS'; payload: { percent: number; label: string } };

export type WebviewToExtensionMessage =
  | { type: 'READY' }
  | { type: 'REQUEST_ANALYSIS'; payload: { filePath?: string } }
  | { type: 'OPEN_FILE'; payload: { filePath: string; line: number } };
```

**Never** expose VS Code APIs or Node.js globals directly to the webview.

---

## 7. Error Handling

Use `CodeScopeError` for all structured errors:

```typescript
// src/core/errors/CodeScopeError.ts
export class CodeScopeError extends Error {
  constructor(
    public readonly code: string,      // e.g. "SCAN_FAILED"
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CodeScopeError';
  }
}
```

In commands, wrap errors:
```typescript
try {
  await scanner.scan(workspaceRoot);
} catch (e) {
  Logger.error('analyzeProject', 'Scan failed', e);
  vscode.window.showErrorMessage(`CodeScope: Scan failed. See Output for details.`);
}
```

---

## 8. Current Phase: Phase 1 — Extension Skeleton

**What we're building now:**

| Item | Status |
|------|--------|
| `package.json` with contribution points | 🔄 |
| `extension.ts` activate/deactivate | 🔄 |
| `core/types/` — all base types | 🔄 |
| `core/logger.ts` | 🔄 |
| `core/registry.ts` | 🔄 |
| `core/errors/CodeScopeError.ts` | 🔄 |
| `providers/SidebarProvider.ts` (HTML placeholder) | 🔄 |
| Command: `codescope.analyzeProject` | 🔄 |
| TypeScript build: 0 errors | 🔄 |
| Extension loads in Extension Development Host | 🔄 |

**What we are NOT building yet:**
- AST parsing
- Any actual analysis
- React UI
- AI

---

## 9. Development Commands

```bash
# Install dependencies
npm install

# Build
npm run compile

# Watch mode (recompile on save)
npm run watch

# Lint
npm run lint

# Run extension in VS Code Extension Development Host
# Press F5 in VS Code with this project open
```

---

## 10. Testing Strategy

### Unit Tests (per analyzer)
- Each file in `analyzer/` must have a corresponding `*.test.ts`.
- Tests use plain Node.js input — no VS Code mocking needed (see Law 2).
- Framework: **Vitest** (fast, zero-config TypeScript).

### Integration Tests
- Use `@vscode/test-electron` for end-to-end extension tests.
- Test that commands register, the sidebar loads, and messages pass correctly.

### Manual Testing Checklist (Phase 1)
- [ ] Extension activates without errors
- [ ] Sidebar icon appears in Activity Bar
- [ ] Sidebar panel opens and renders placeholder HTML
- [ ] `Ctrl+Shift+P` → "CodeScope: Analyze Project" runs without crash
- [ ] Progress notification appears and dismisses
- [ ] Output channel "CodeScope" receives log messages

---

## 11. Commit Message Convention

```
<type>(<scope>): <subject>

Types: feat | fix | refactor | test | docs | chore
Scopes: core | analyzer | commands | providers | webview | ai | extension

Examples:
feat(core): add CodebaseGraph type definitions
fix(analyzer): handle empty workspace in projectScanner
refactor(providers): extract message types to shared module
```

---

## 12. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-03 | Use TypeScript Compiler API for AST parsing | Best accuracy for TS projects; native types |
| 2026-09-03 | No database in Phase 1–4 | In-memory is fast; persistence can be added later |
| 2026-09-03 | Analyzers have zero `vscode` imports | Testability; clean separation of concerns |
| 2026-09-03 | `AnalysisResult<T>` wrapper (not exceptions) | Explicit error handling in analyzers |
| 2026-09-03 | React for webview UI | Component reusability; easier state management for dashboard |

---

## 13. Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files (classes) | PascalCase | `SidebarProvider.ts` |
| Files (utils/services) | camelCase | `logger.ts` |
| Interfaces | PascalCase, no `I` prefix | `CodeEntity` |
| Types | PascalCase | `CodeEntityKind` |
| Enums | PascalCase, values PascalCase | `DependencyKind.Import` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE` |
| Functions | camelCase | `buildDependencyGraph()` |
| VS Code commands | `codescope.<camelCase>` | `codescope.analyzeProject` |

---

## 14. Open Technical Questions

- [ ] Tree-sitter vs TypeScript Compiler API for multi-language support?
- [ ] Webview persistence: `retainContextWhenHidden` = true? (memory cost)
- [ ] Workspace index — rebuild on every open or cache to `.vscode/codescope/index.json`?
- [ ] Which npm vulnerability data source to use in Phase 5?
