// src/commands/ignoreDeadCode.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.ignoreDeadCode
// Adds an entity ID to the ignored dead code list in workspace settings.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { DeadCodeTreeNode } from '../providers/DeadCodeTreeProvider';

export function registerIgnoreDeadCodeCommand(context: vscode.ExtensionContext): vscode.Disposable {
  void context;

  return vscode.commands.registerCommand(
    'devxray.ignoreDeadCode',
    async (node?: DeadCodeTreeNode) => {
      if (!node || !node.entity) {
        return;
      }

      const entityId = node.entity.id;
      Logger.info('ignoreDeadCode', `Ignoring dead code entity: ${entityId}`);

      const config = vscode.workspace.getConfiguration('devxray');
      const ignoredList = config.get<string[]>('ignoredDeadCode', []);

      if (!ignoredList.includes(entityId)) {
        const newList = [...ignoredList, entityId];
        await config.update('ignoredDeadCode', newList, vscode.ConfigurationTarget.Workspace);
        Logger.debug('ignoreDeadCode', 'Updated config', { newList });
      }
    }
  );
}
