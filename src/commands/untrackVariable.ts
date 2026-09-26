// src/commands/untrackVariable.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.untrackVariable
// Removes a variable from the VariableTracker.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Registry } from '../core/registry';
import { VariableTracker } from '../analyzer/debugger/variableTracker';
import { VariableTreeNode } from '../providers/VariableTreeProvider';

export function registerUntrackVariableCommand(context: vscode.ExtensionContext): vscode.Disposable {
  void context;

  return vscode.commands.registerCommand('devxray.untrackVariable', (node?: VariableTreeNode) => {
    if (!node) return;

    const tracker = Registry.has(VariableTracker) ? Registry.get(VariableTracker) : undefined;
    if (tracker) {
      tracker.untrackVariable(node.variableName);
    }
  });
}
