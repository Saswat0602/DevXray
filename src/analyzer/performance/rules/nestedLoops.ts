// src/analyzer/performance/rules/nestedLoops.ts
// ─────────────────────────────────────────────────────────────────────────────
// Rule: Detects nested loops which can cause O(n^2) or worse complexity.
// ─────────────────────────────────────────────────────────────────────────────

import * as ts from 'typescript';
import { Rule, PerformanceIssue } from './Rule';

function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

export const nestedLoopsRule: Rule = {
  id: 'nested-loops',
  name: 'Nested Loops',
  description: 'Loops inside other loops can lead to exponential time complexity.',
  severity: 'MEDIUM',

  analyze(node: ts.Node, sourceFile: ts.SourceFile): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    if (isLoop(node)) {
      const findNestedLoops = (child: ts.Node): void => {
        // Stop traversing if we hit a new function boundary
        if (ts.isFunctionDeclaration(child) || ts.isArrowFunction(child) || ts.isMethodDeclaration(child) || ts.isFunctionExpression(child)) {
          return;
        }

        if (isLoop(child)) {
          const start = sourceFile.getLineAndCharacterOfPosition(child.getStart(sourceFile));
          const end = sourceFile.getLineAndCharacterOfPosition(child.getEnd());
          
          issues.push({
            ruleId: nestedLoopsRule.id,
            ruleName: nestedLoopsRule.name,
            message: 'Nested loop detected (O(N²) complexity).',
            severity: nestedLoopsRule.severity,
            line: start.line,
            character: start.character,
            endLine: end.line,
            endCharacter: end.character,
            suggestion: 'Consider using hash maps/Sets to reduce lookup times instead of nested iterations.',
          });
        }
        
        ts.forEachChild(child, findNestedLoops);
      };

      let body: ts.Node | undefined;
      if (ts.isForStatement(node)) body = node.statement;
      else if (ts.isForInStatement(node)) body = node.statement;
      else if (ts.isForOfStatement(node)) body = node.statement;
      else if (ts.isWhileStatement(node)) body = node.statement;
      else if (ts.isDoStatement(node)) body = node.statement;

      if (body) {
        ts.forEachChild(body, findNestedLoops);
      }
    }

    return issues;
  }
};
