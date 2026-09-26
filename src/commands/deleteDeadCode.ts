// src/commands/deleteDeadCode.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.deleteDeadCode
// Safely deletes unused code by line range (with user confirmation).
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../core/logger';
import { DeadCodeTreeNode } from '../providers/DeadCodeTreeProvider';

export function registerDeleteDeadCodeCommand(context: vscode.ExtensionContext): vscode.Disposable {
  void context;

  return vscode.commands.registerCommand(
    'devxray.deleteDeadCode',
    async (node?: DeadCodeTreeNode) => {
      if (!node || !node.entity) {
        return;
      }

      const entity = node.entity;
      const fileName = path.basename(entity.filePath);

      // Confirm before deleting
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete ${entity.name} (${entity.kind}) from ${fileName}?`,
        { modal: true },
        'Delete'
      );

      if (confirmation !== 'Delete') {
        return;
      }

      try {
        const uri = vscode.Uri.file(entity.filePath);
        const edit = new vscode.WorkspaceEdit();

        if (entity.kind === 'file') {
          // Delete entire file
          edit.deleteFile(uri, { ignoreIfNotExists: true, recursive: false });
        } else {
          // Delete the line range
          // Lines in AST are 1-indexed, VS Code uses 0-indexed ranges
          // To delete the whole lines including newline, we delete from (startLine-1, 0) to (endLine, 0)
          const startLine = Math.max(0, entity.startLine - 1);
          const endLine = entity.endLine; // The start of the next line (0-indexed)
          
          const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, 0) // Up to column 0 of the line *after* the endLine
          );
          
          edit.delete(uri, range);
        }

        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
          Logger.info('deleteDeadCode', `Successfully deleted ${entity.name}`);
          // Note: The file watcher will catch this edit and update the graph automatically!
        } else {
          throw new Error('WorkspaceEdit was rejected.');
        }

      } catch (e) {
        Logger.error('deleteDeadCode', 'Failed to delete dead code', e);
        void vscode.window.showErrorMessage(`DevXray: Failed to delete code - ${String(e)}`);
      }
    }
  );
}
