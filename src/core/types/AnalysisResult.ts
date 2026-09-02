// src/core/types/AnalysisResult.ts
// ─────────────────────────────────────────────────────────────────────────────
// Result monad for analyzer return values.
// Keeps error handling explicit — no thrown exceptions leaking from analyzers.
// ─────────────────────────────────────────────────────────────────────────────

import { CodeScopeError } from '../errors/CodeScopeError';

/**
 * A discriminated union result type returned by all analyzers.
 *
 * Usage:
 *   const result = await analyzer.run(graph);
 *   if (!result.ok) { handle(result.error); return; }
 *   use(result.data);
 */
export type AnalysisResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: CodeScopeError };

/** Create a successful result */
export function ok<T>(data: T): AnalysisResult<T> {
  return { ok: true, data };
}

/** Create a failed result */
export function err<T>(error: CodeScopeError): AnalysisResult<T> {
  return { ok: false, error };
}

/** Type guard: narrows result to the success case */
export function isOk<T>(result: AnalysisResult<T>): result is { ok: true; data: T } {
  return result.ok;
}

/** Type guard: narrows result to the failure case */
export function isErr<T>(
  result: AnalysisResult<T>,
): result is { ok: false; error: CodeScopeError } {
  return !result.ok;
}
