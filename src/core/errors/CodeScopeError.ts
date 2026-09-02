// src/core/errors/CodeScopeError.ts
// ─────────────────────────────────────────────────────────────────────────────
// Structured error type used throughout CodeScope.
// Always use this instead of throwing plain Error objects.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known error codes for CodeScope operations.
 * Add new codes here as new analyzers are introduced.
 */
export type CodeScopeErrorCode =
  | 'NO_WORKSPACE'           // No workspace folder is open
  | 'SCAN_FAILED'            // ProjectScanner encountered an unrecoverable error
  | 'FILE_READ_ERROR'        // Could not read a specific file
  | 'PARSE_ERROR'            // AST parsing failed for a file
  | 'INDEX_NOT_READY'        // A feature was invoked before the index was built
  | 'DEPENDENCY_SCAN_FAILED' // npm dependency analysis failed
  | 'UNKNOWN';               // Catch-all for unexpected errors

/**
 * Structured error class used by all CodeScope services.
 *
 * @example
 * throw new CodeScopeError('NO_WORKSPACE', 'Please open a workspace before running CodeScope.');
 *
 * @example
 * throw new CodeScopeError('SCAN_FAILED', 'Could not scan workspace', originalError);
 */
export class CodeScopeError extends Error {
  public readonly code: CodeScopeErrorCode;
  public readonly cause: unknown;

  constructor(code: CodeScopeErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'CodeScopeError';
    this.code = code;
    this.cause = cause;
  }

  /**
   * Wraps any unknown error into a CodeScopeError.
   * Use at catch boundaries to normalise errors.
   */
  static from(cause: unknown, code: CodeScopeErrorCode = 'UNKNOWN'): CodeScopeError {
    if (cause instanceof CodeScopeError) {
      return cause;
    }
    const message =
      cause instanceof Error ? cause.message : String(cause);
    return new CodeScopeError(code, message, cause);
  }
}
