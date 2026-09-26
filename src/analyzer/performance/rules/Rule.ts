// src/analyzer/performance/rules/Rule.ts
// ─────────────────────────────────────────────────────────────────────────────
// Base interface for all performance rules.
// ─────────────────────────────────────────────────────────────────────────────

import * as ts from 'typescript';

export type PerformanceSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PerformanceIssue {
  ruleId: string;
  ruleName: string;
  message: string;
  severity: PerformanceSeverity;
  line: number;
  character: number;
  endLine: number;
  endCharacter: number;
  suggestion?: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: PerformanceSeverity;
  
  /**
   * Analyzes an AST node and returns a list of issues found.
   */
  analyze(node: ts.Node, sourceFile: ts.SourceFile): PerformanceIssue[];
}
