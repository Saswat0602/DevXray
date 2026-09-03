// src/core/types/WebviewMessage.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typed message protocol between the extension host and webview (React).
// Both sides must import only from this file — never from each other directly.
// ─────────────────────────────────────────────────────────────────────────────

// ── Extension Host → Webview ─────────────────────────────────────────────────

export type ExtensionToWebviewMessage =
  | {
      type: 'SCAN_PROGRESS';
      payload: {
        percent: number;   // 0–100
        label: string;     // Human-readable status label
      };
    }
  | {
      type: 'SCAN_COMPLETE';
      payload: {
        fileCount: number;
        entityCount: number;
        edgeCount: number;
        durationMs: number;
      };
    }
  | {
      type: 'SCAN_ERROR';
      payload: {
        message: string;
        code: string;
      };
    }
  | {
      type: 'GRAPH_UPDATED';
      payload: SerializedCodebaseGraph;
    };

// ── Webview → Extension Host ─────────────────────────────────────────────────

export type WebviewToExtensionMessage =
  | { type: 'READY' }
  | {
      type: 'REQUEST_ANALYZE_PROJECT';
    }
  | {
      type: 'REQUEST_ANALYZE_FILE';
      payload: { filePath: string };
    }
  | {
      type: 'OPEN_FILE';
      payload: { filePath: string; line: number };
    }
  | {
      type: 'REQUEST_SCAN_DEPENDENCIES';
    };

// ── Serialized Graph (safe for postMessage) ───────────────────────────────────

/**
 * JSON-serializable snapshot of the CodebaseGraph.
 * The real CodebaseGraph uses ReadonlyMap; this uses plain objects for transport.
 */
export interface SerializedCodebaseGraph {
  entities: Array<{
    id: string;
    name: string;
    kind: string;
    filePath: string;
    startLine: number;
    endLine: number;
    isExported: boolean;
  }>;
  edges: Array<{
    from: string;
    to: string;
    kind: string;
    filePath: string;
    line: number;
  }>;
  scannedAt: string;   // ISO 8601
  fileCount: number;
}

/**
 * Converts a CodebaseGraph to a JSON-safe SerializedCodebaseGraph for webview postMessage.
 */
export function serializeGraph(
  graph: import('./Dependency').CodebaseGraph,
): SerializedCodebaseGraph {
  return {
    entities: Array.from(graph.entities.values()).map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      filePath: e.filePath,
      startLine: e.startLine,
      endLine: e.endLine,
      isExported: e.isExported,
    })),
    edges: graph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      filePath: edge.filePath,
      line: edge.line,
    })),
    scannedAt: graph.scannedAt.toISOString(),
    fileCount: graph.fileCount,
  };
}

