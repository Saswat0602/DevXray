// src/commands/updatePackage.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.updatePackage
// Opens a terminal and runs `npm install <package>@latest`.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { DependencyPackageNode } from '../providers/DependencyTreeProvider';

export function registerUpdatePackageCommand(context: vscode.ExtensionContext): vscode.Disposable {
  void context;

  return vscode.commands.registerCommand(
    'devxray.updatePackage',
    (node?: DependencyPackageNode) => {
      if (!node || !node.info) {
        return;
      }

      const packageName = node.info.name;
      const latestVersion = node.info.latestVersion;

      if (!latestVersion) {
        void vscode.window.showErrorMessage(`DevXray: Could not determine latest version for ${packageName}.`);
        return;
      }

      Logger.info('updatePackage', `Updating ${packageName} to @latest`);

      const terminalName = 'DevXray: Update Package';
      let terminal = vscode.window.terminals.find(t => t.name === terminalName);
      
      if (!terminal) {
        terminal = vscode.window.createTerminal(terminalName);
      }

      terminal.show();
      terminal.sendText(`npm install ${packageName}@latest`);
    }
  );
}
