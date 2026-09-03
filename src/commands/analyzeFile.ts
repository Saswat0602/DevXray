// src/commands/analyzeFile.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.analyzeFile
// Analyzes the currently active file (or a file path passed as argument).
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { CodeScopeError } from '../core/errors/CodeScopeError';

/**
 * Registers the `devxray.analyzeFile` command.
 */
export function registerAnalyzeFileCommand(
  context?: vscode.ExtensionContext,
): vscode.Disposable {
  void context;

  return vscode.commands.registerCommand(
    'devxray.analyzeFile',
    (filePath?: string) => {
      // Resolve the target file path
      const targetPath = filePath ?? vscode.window.activeTextEditor?.document.uri.fsPath;

      if (!targetPath) {
        void vscode.window.showWarningMessage(
          'DevXray: Open a file in the editor before running Analyze File.',
        );
        Logger.warn('analyzeFile', 'No active file');
        return;
      }

      Logger.info('analyzeFile', 'Command invoked', { targetPath });

      try {
        void vscode.window.showInformationMessage(
          `DevXray: Active file — ${targetPath}`,
        );
      } catch (e) {
        const error = CodeScopeError.from(e, 'SCAN_FAILED');
        Logger.error('analyzeFile', 'File analysis failed', error);
        void vscode.window.showErrorMessage(`DevXray: ${error.message}`);
      }
    },
  );
}
