// src/analyzer/performance/rules/syncInAsync.ts
// ─────────────────────────────────────────────────────────────────────────────
// Rule: Detects synchronous blocking operations inside async functions.
// ─────────────────────────────────────────────────────────────────────────────

import * as ts from 'typescript';
import { Rule, PerformanceIssue } from './Rule';

const SYNC_METHODS = new Set([
  'readFileSync',
  'writeFileSync',
  'appendFileSync',
  'existsSync',
  'statSync',
  'mkdirSync',
  'rmdirSync',
  'renameSync',
  'copyFileSync',
  'unlinkSync',
  'execSync',
  'spawnSync'
]);

function isAsyncFunction(node: ts.Node): boolean {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  ) {
    return node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
  }
  return false;
}

export const syncInAsyncRule: Rule = {
  id: 'sync-in-async',
  name: 'Sync in Async',
  description: 'Calling synchronous I/O methods inside an async function blocks the event loop.',
  severity: 'HIGH',

  analyze(node: ts.Node, sourceFile: ts.SourceFile): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    if (isAsyncFunction(node)) {
      const findSyncCalls = (child: ts.Node): void => {
        // Stop if we enter another function that is NOT async (if it is async, we'd process it when visit() hits it)
        if (
          ts.isFunctionDeclaration(child) ||
          ts.isMethodDeclaration(child) ||
          ts.isArrowFunction(child) ||
          ts.isFunctionExpression(child)
        ) {
          return;
        }

        if (ts.isCallExpression(child)) {
          let methodName = '';
          if (ts.isIdentifier(child.expression)) {
            methodName = child.expression.text;
          } else if (ts.isPropertyAccessExpression(child.expression)) {
            methodName = child.expression.name.text;
          }

          if (methodName && SYNC_METHODS.has(methodName)) {
            const start = sourceFile.getLineAndCharacterOfPosition(child.getStart(sourceFile));
            const end = sourceFile.getLineAndCharacterOfPosition(child.getEnd());
            
            issues.push({
              ruleId: syncInAsyncRule.id,
              ruleName: syncInAsyncRule.name,
              message: `Blocking synchronous call '${methodName}' inside an async function.`,
              severity: syncInAsyncRule.severity,
              line: start.line,
              character: start.character,
              endLine: end.line,
              endCharacter: end.character,
              suggestion: `Use the asynchronous version of '${methodName}' (e.g., promises or callbacks) to avoid blocking the event loop.`,
            });
          }
        }
        
        ts.forEachChild(child, findSyncCalls);
      };

      // Traverse function body
      let body: ts.Node | undefined;
      if (ts.isFunctionDeclaration(node)) body = node.body;
      else if (ts.isMethodDeclaration(node)) body = node.body;
      else if (ts.isArrowFunction(node)) body = node.body;
      else if (ts.isFunctionExpression(node)) body = node.body;

      if (body) {
        ts.forEachChild(body, findSyncCalls);
      }
    }

    return issues;
  }
};
