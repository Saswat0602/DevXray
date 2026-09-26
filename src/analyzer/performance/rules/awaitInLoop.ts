// src/analyzer/performance/rules/awaitInLoop.ts
// ─────────────────────────────────────────────────────────────────────────────
// Rule: Detects await expressions inside loops.
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

export const awaitInLoopRule: Rule = {
  id: 'await-in-loop',
  name: 'Await in Loop',
  description: 'Await expressions inside loops cause sequential execution.',
  severity: 'HIGH',

  analyze(node: ts.Node, sourceFile: ts.SourceFile): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    if (isLoop(node)) {
      // Find all await expressions inside this loop's body
      const findAwaits = (child: ts.Node): void => {
        // Stop traversing if we hit a new function boundary
        if (ts.isFunctionDeclaration(child) || ts.isArrowFunction(child) || ts.isMethodDeclaration(child) || ts.isFunctionExpression(child)) {
          return;
        }

        if (ts.isAwaitExpression(child) || (ts.isForOfStatement(child) && child.awaitModifier)) {
          const start = sourceFile.getLineAndCharacterOfPosition(child.getStart(sourceFile));
          const end = sourceFile.getLineAndCharacterOfPosition(child.getEnd());
          
          issues.push({
            ruleId: awaitInLoopRule.id,
            ruleName: awaitInLoopRule.name,
            message: 'Await inside loop causes sequential execution.',
            severity: awaitInLoopRule.severity,
            line: start.line,
            character: start.character,
            endLine: end.line,
            endCharacter: end.character,
            suggestion: 'Consider using Promise.all() to run tasks concurrently.',
          });
        }
        
        ts.forEachChild(child, findAwaits);
      };

      // Traverse the loop body
      let body: ts.Node | undefined;
      if (ts.isForStatement(node)) body = node.statement;
      else if (ts.isForInStatement(node)) body = node.statement;
      else if (ts.isForOfStatement(node)) body = node.statement;
      else if (ts.isWhileStatement(node)) body = node.statement;
      else if (ts.isDoStatement(node)) body = node.statement;

      if (body) {
        ts.forEachChild(body, findAwaits);
      }
    }

    return issues;
  }
};
