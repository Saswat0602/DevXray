// src/core/types/Dependency.ts
// ─────────────────────────────────────────────────────────────────────────────
// Core domain type: a directed edge between two CodeEntities in the graph.
// ─────────────────────────────────────────────────────────────────────────────

/** The nature of a relationship between two CodeEntities */
export type DependencyKind =
  | 'import'      // File A imports from File B
  | 'call'        // Function A calls Function B
  | 'extends'     // Class A extends Class B
  | 'implements'  // Class A implements Interface B
  | 'reference';  // A variable/type references another entity

/**
 * A directed edge from one CodeEntity to another.
 *
 * The `from` and `to` values are `CodeEntity.id` strings.
 * Together, a set of DependencyEdges forms the CodebaseGraph.
 */
export interface DependencyEdge {
  /** CodeEntity.id of the source (the entity that depends on something) */
  readonly from: string;

  /** CodeEntity.id of the target (the entity being depended upon) */
  readonly to: string;

  /** The nature of this dependency */
  readonly kind: DependencyKind;

  /** Absolute path to the file where this edge originates */
  readonly filePath: string;

  /** 1-indexed line where this edge originates */
  readonly line: number;
}

/**
 * The complete, indexed codebase graph.
 * This is the central data structure that all analyzers consume.
 */
export interface CodebaseGraph {
  /** All discovered entities, indexed by their ID for O(1) lookup */
  readonly entities: ReadonlyMap<string, import('./CodeEntity').CodeEntity>;

  /** All directed dependency edges */
  readonly edges: ReadonlyArray<DependencyEdge>;

  /** Timestamp of when this graph was last built */
  readonly scannedAt: Date;

  /** Total number of files that were scanned */
  readonly fileCount: number;
}
