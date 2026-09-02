// src/commands/analyzeFile.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.analyzeFile
// Analyzes the currently active file (or a file path passed as argument).
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { CodeScopeError } from '../core/errors/CodeScopeError';

/**
 * Registers the `codescope.analyzeFile` command.
 */
export function registerAnalyzeFileCommand(
  _context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'devxray.analyzeFile',
    async (filePath?: string) => {
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
        // Phase 2 will plug real per-file analysis here.
        void vscode.window.showInformationMessage(
          `DevXray: File analysis coming in Phase 2 — ${targetPath}`,
        );
      } catch (e) {
        const error = CodeScopeError.from(e, 'SCAN_FAILED');
        Logger.error('analyzeFile', 'File analysis failed', error);
        void vscode.window.showErrorMessage(`DevXray: ${error.message}`);
      }
    },
  );
}
