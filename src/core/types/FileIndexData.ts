// src/core/types/FileIndexData.ts
// ─────────────────────────────────────────────────────────────────────────────
// Intermediate AST extraction results for a single file.
// Used by FileIndexer to pass data to DependencyGraphBuilder.
// ─────────────────────────────────────────────────────────────────────────────

import { CodeEntity } from './CodeEntity';

/** Represents an imported symbol in an import statement */
export interface ImportSpecifierInfo {
  /** The symbol name as exported in the source module */
  readonly importedName: string;
  /** The local variable name bound in the importing file */
  readonly localName: string;
  /** True if this is a default import (`import foo from './bar'`) */
  readonly isDefault?: boolean;
  /** True if this is a namespace import (`import * as foo from './bar'`) */
  readonly isNamespace?: boolean;
}

/** Represents an import statement in a file */
export interface ImportRecord {
  /** The module specifier string (e.g., './utils', 'lodash') */
  readonly moduleSpecifier: string;
  /** Individual specifiers imported */
  readonly specifiers: ReadonlyArray<ImportSpecifierInfo>;
  /** 1-indexed line where the import occurs */
  readonly line: number;
}

/** Represents a function/method call expression */
export interface CallRecord {
  /** Name of the function/method being called */
  readonly calleeName: string;
  /** CodeEntity ID of the containing function/method/class, if any */
  readonly callerEntityId?: string;
  /** 1-indexed line where the call occurs */
  readonly line: number;
}

/** Represents class inheritance or interface implementation */
export interface HeritageRecord {
  /** CodeEntity ID of the inheriting class or interface */
  readonly entityId: string;
  /** Target class or interface name */
  readonly targetName: string;
  /** 'extends' or 'implements' */
  readonly kind: 'extends' | 'implements';
  /** 1-indexed line */
  readonly line: number;
}

/** Complete raw AST extraction output for a single file */
export interface FileIndexResult {
  /** Absolute path to the indexed file */
  readonly filePath: string;
  /** The top-level file entity */
  readonly fileEntity: CodeEntity;
  /** All entities discovered in this file (functions, classes, variables, etc.) */
  readonly entities: ReadonlyArray<CodeEntity>;
  /** All import statements */
  readonly imports: ReadonlyArray<ImportRecord>;
  /** All function/method calls */
  readonly calls: ReadonlyArray<CallRecord>;
  /** All class extends / implements clauses */
  readonly heritage: ReadonlyArray<HeritageRecord>;
}
