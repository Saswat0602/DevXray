// src/providers/PerformanceDiagnostics.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages the VS Code Diagnostic Collection for performance issues.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import * as ts from 'typescript';
import { PerformanceAnalyzer } from '../analyzer/performance/performanceAnalyzer';
import { PerformanceIssue } from '../analyzer/performance/rules/Rule';

export class PerformanceDiagnostics {
  private static _collection: vscode.DiagnosticCollection;

  public static initialize(context: vscode.ExtensionContext): void {
    this._collection = vscode.languages.createDiagnosticCollection('devxray-perf');
    context.subscriptions.push(this._collection);
  }

  public static analyzeDocument(document: vscode.TextDocument): PerformanceIssue[] {
    if (document.languageId !== 'typescript' && document.languageId !== 'javascript' &&
        document.languageId !== 'typescriptreact' && document.languageId !== 'javascriptreact') {
      return [];
    }

    const sourceFile = ts.createSourceFile(
      document.fileName,
      document.getText(),
      ts.ScriptTarget.Latest,
      true
    );

    const issues = PerformanceAnalyzer.analyze(sourceFile);
    this._updateDiagnostics(document.uri, issues);
    
    return issues;
  }

  public static clear(uri: vscode.Uri): void {
    this._collection.delete(uri);
  }

  private static _updateDiagnostics(uri: vscode.Uri, issues: PerformanceIssue[]): void {
    const diagnostics = issues.map(issue => {
      const range = new vscode.Range(
        issue.line,
        issue.character,
        issue.endLine,
        issue.endCharacter
      );

      let severity = vscode.DiagnosticSeverity.Information;
      if (issue.severity === 'HIGH') severity = vscode.DiagnosticSeverity.Error;
      else if (issue.severity === 'MEDIUM') severity = vscode.DiagnosticSeverity.Warning;

      const diagnostic = new vscode.Diagnostic(
        range,
        `DevXray [${issue.ruleName}]: ${issue.message}\n${issue.suggestion ?? ''}`,
        severity
      );
      
      diagnostic.code = issue.ruleId;
      diagnostic.source = 'DevXray Perf';
      return diagnostic;
    });

    this._collection.set(uri, diagnostics);
  }
}
