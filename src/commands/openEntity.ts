// src/commands/openEntity.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.openEntity
// Opens a file and scrolls to the specific line.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { CodeScopeError } from '../core/errors/CodeScopeError';

export function registerOpenEntityCommand(context?: vscode.ExtensionContext): vscode.Disposable {
  void context;

  return vscode.commands.registerCommand(
    'devxray.openEntity',
    async (filePath: string, line: number) => {
      Logger.debug('openEntity', 'Command invoked', { filePath, line });

      try {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        // VS Code uses 0-indexed lines
        const targetLine = Math.max(0, line - 1);
        const position = new vscode.Position(targetLine, 0);
        const range = new vscode.Range(position, position);

        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      } catch (e) {
        const error = CodeScopeError.from(e, 'UNKNOWN');
        Logger.error('openEntity', 'Failed to open entity', error);
        void vscode.window.showErrorMessage(`DevXray: ${error.message}`);
      }
    }
  );
}
