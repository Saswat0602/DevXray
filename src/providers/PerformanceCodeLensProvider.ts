// src/providers/PerformanceCodeLensProvider.ts
// ─────────────────────────────────────────────────────────────────────────────
// Provides inline CodeLens badges for performance issues.
// ─────────────────────────────────────────────────────────────────────────────
import * as vscode from 'vscode';
import { PerformanceDiagnostics } from './PerformanceDiagnostics';

export class PerformanceCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const config = vscode.workspace.getConfiguration('devxray');
    if (!config.get<boolean>('enablePerformanceAnalysis', true)) {
      PerformanceDiagnostics.clear(document.uri);
      return [];
    }

    // This analyzes the document, updates diagnostics, and returns issues.
    // It's called automatically by VS Code when the document changes (debounced).
    const issues = PerformanceDiagnostics.analyzeDocument(document);

    return issues.map(issue => {
      const range = new vscode.Range(issue.line, 0, issue.line, 0);
      
      const icon = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟠' : '🔵';
      
      return new vscode.CodeLens(range, {
        title: `${icon} DevXray: ${issue.ruleName} - ${issue.message}`,
        command: '', // No command needed, just informational
        arguments: []
      });
    });
  }
}
