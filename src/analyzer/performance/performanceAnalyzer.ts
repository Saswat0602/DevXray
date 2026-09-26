// src/analyzer/performance/performanceAnalyzer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Engine that evaluates registered rules on a given source file.
// ─────────────────────────────────────────────────────────────────────────────

import * as ts from 'typescript';
import { Rule, PerformanceIssue } from './rules/Rule';
import { awaitInLoopRule } from './rules/awaitInLoop';
import { nestedLoopsRule } from './rules/nestedLoops';
import { syncInAsyncRule } from './rules/syncInAsync';

export class PerformanceAnalyzer {
  private static _rules: Rule[] = [
    awaitInLoopRule,
    nestedLoopsRule,
    syncInAsyncRule,
  ];

  /**
   * Analyzes a complete source file and returns all performance issues found.
   */
  public static analyze(sourceFile: ts.SourceFile): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    const visit = (node: ts.Node) => {
      for (const rule of this._rules) {
        issues.push(...rule.analyze(node, sourceFile));
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return issues;
  }
}
