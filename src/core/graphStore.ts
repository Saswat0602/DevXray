// src/core/graphStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// In-memory store for the active CodebaseGraph.
// Singleton service managed via Registry.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { CodebaseGraph, DependencyEdge } from './types/Dependency';
import { CodeEntity } from './types/CodeEntity';
import { FileIndexResult } from './types/FileIndexData';
import { DependencyGraphBuilder } from '../analyzer/codebase/dependencyGraph';

export type GraphChangeListener = (graph: CodebaseGraph | undefined) => void;

/**
 * Manages the in-memory active CodebaseGraph and provides fast indexed lookups.
 */
export class GraphStore {
  private _graph: CodebaseGraph | undefined;
  private readonly _listeners = new Set<GraphChangeListener>();
  private _indexResults = new Map<string, FileIndexResult>();

  // Cached index mappings for O(1) edge lookups
  private _inboundEdges = new Map<string, DependencyEdge[]>();
  private _outboundEdges = new Map<string, DependencyEdge[]>();
  private _fileToEntities = new Map<string, CodeEntity[]>();

  /** Get the current indexed codebase graph */
  public getGraph(): CodebaseGraph | undefined {
    return this._graph;
  }

  /** Set a new codebase graph and update internal lookup indices */
  public setGraph(graph: CodebaseGraph): void {
    this._graph = graph;
    this._rebuildIndices(graph);
    this._notifyListeners();
  }

  public setIndexResults(results: FileIndexResult[]): void {
    this._indexResults.clear();
    for (const r of results) {
      this._indexResults.set(r.filePath, r);
    }
    this._rebuildGraph();
  }

  public updateFile(result: FileIndexResult): void {
    this._indexResults.set(result.filePath, result);
    this._rebuildGraph();
  }

  public removeFile(filePath: string): void {
    this._indexResults.delete(filePath);
    this._rebuildGraph();
  }

  private _rebuildGraph(): void {
    const result = DependencyGraphBuilder.build(Array.from(this._indexResults.values()));
    if (result.ok) {
      this.setGraph(result.data);
    }
  }

  public async saveToStorage(context: vscode.ExtensionContext): Promise<void> {
    const results = Array.from(this._indexResults.values());
    await context.workspaceState.update('devxray.indexResults', results);
  }

  public loadFromStorage(context: vscode.ExtensionContext): boolean {
    const results = context.workspaceState.get<FileIndexResult[]>('devxray.indexResults');
    if (results && results.length > 0) {
      this.setIndexResults(results);
      return true;
    }
    return false;
  }

  /** Get an entity by ID */
  public getEntity(id: string): CodeEntity | undefined {
    return this._graph?.entities.get(id);
  }

  /** Get all entities discovered in a particular file */
  public getEntitiesByFile(filePath: string): ReadonlyArray<CodeEntity> {
    return this._fileToEntities.get(filePath) ?? [];
  }

  /** Get all edges that point to this entity (what calls/imports this) */
  public getInboundEdges(entityId: string): ReadonlyArray<DependencyEdge> {
    return this._inboundEdges.get(entityId) ?? [];
  }

  /** Get all edges originating from this entity (what this calls/imports) */
  public getOutboundEdges(entityId: string): ReadonlyArray<DependencyEdge> {
    return this._outboundEdges.get(entityId) ?? [];
  }

  /** Subscribe to graph updates */
  public onDidChangeGraph(listener: GraphChangeListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Clear the stored graph */
  public clear(): void {
    this._graph = undefined;
    this._indexResults.clear();
    this._inboundEdges.clear();
    this._outboundEdges.clear();
    this._fileToEntities.clear();
    this._notifyListeners();
  }

  private _rebuildIndices(graph: CodebaseGraph): void {
    this._inboundEdges.clear();
    this._outboundEdges.clear();
    this._fileToEntities.clear();

    // Index entities by file
    for (const entity of graph.entities.values()) {
      const list = this._fileToEntities.get(entity.filePath);
      if (list) {
        list.push(entity);
      } else {
        this._fileToEntities.set(entity.filePath, [entity]);
      }
    }

    // Index edges by source and destination
    for (const edge of graph.edges) {
      // Outbound (from -> to)
      const outList = this._outboundEdges.get(edge.from);
      if (outList) {
        outList.push(edge);
      } else {
        this._outboundEdges.set(edge.from, [edge]);
      }

      // Inbound (to <- from)
      const inList = this._inboundEdges.get(edge.to);
      if (inList) {
        inList.push(edge);
      } else {
        this._inboundEdges.set(edge.to, [edge]);
      }
    }
  }

  private _notifyListeners(): void {
    for (const listener of this._listeners) {
      try {
        listener(this._graph);
      } catch {
        // Safe dispatch: errors in listeners shouldn't break graph state
      }
    }
  }
}
