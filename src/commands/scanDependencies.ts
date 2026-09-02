// src/commands/scanDependencies.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.scanDependencies
// Reads package.json and surfaces dependency information.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { CodeScopeError } from '../core/errors/CodeScopeError';

/**
 * Registers the `codescope.scanDependencies` command.
 */
export function registerScanDependenciesCommand(
  _context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('devxray.scanDependencies', async () => {
    Logger.info('scanDependencies', 'Command invoked');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      void vscode.window.showErrorMessage(
        'DevXray: Please open a workspace folder first.',
      );
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    try {
      // Phase 5 will plug the real DependencyAnalyzer here.
      Logger.info('scanDependencies', 'Dependency scan placeholder', { workspaceRoot });
      void vscode.window.showInformationMessage(
        'DevXray: Dependency scanning coming in Phase 5.',
      );
    } catch (e) {
      const error = CodeScopeError.from(e, 'DEPENDENCY_SCAN_FAILED');
      Logger.error('scanDependencies', 'Dependency scan failed', error);
      void vscode.window.showErrorMessage(`DevXray: ${error.message}`);
    }
  });
}
