// src/core/types/CodeEntity.ts
// ─────────────────────────────────────────────────────────────────────────────
// Core domain type: a single named entity discovered in the codebase.
// This is the fundamental node in the CodebaseGraph.
// ─────────────────────────────────────────────────────────────────────────────

export type CodeEntityKind =
  | 'file'
  | 'class'
  | 'function'
  | 'arrow-function'
  | 'variable'
  | 'export'
  | 'interface'
  | 'type'
  | 'enum';

/**
 * A single named entity discovered in the codebase.
 *
 * Entities are nodes in the CodebaseGraph. They are immutable once created.
 * IDs follow the pattern: `${filePath}::${kind}::${name}`
 */
export interface CodeEntity {
  /** Globally unique ID: `${filePath}::${kind}::${name}` */
  readonly id: string;

  /** Human-readable name (function name, class name, file basename, etc.) */
  readonly name: string;

  /** What kind of syntactic construct this entity represents */
  readonly kind: CodeEntityKind;

  /** Absolute path to the file containing this entity */
  readonly filePath: string;

  /** 1-indexed line where this entity starts */
  readonly startLine: number;

  /** 1-indexed line where this entity ends */
  readonly endLine: number;

  /** Whether this entity is exported from its module */
  readonly isExported: boolean;
}

/**
 * Factory for creating CodeEntity IDs.
 * Centralised to ensure consistency across the codebase.
 */
export function makeEntityId(
  filePath: string,
  kind: CodeEntityKind,
  name: string,
): string {
  return `${filePath}::${kind}::${name}`;
}
