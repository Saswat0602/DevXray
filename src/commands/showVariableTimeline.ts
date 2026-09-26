// src/commands/showVariableTimeline.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.showVariableTimeline
// Opens the timeline webview for a tracked variable.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { VariableTreeNode } from '../providers/VariableTreeProvider';
import { VariableTimelinePanel } from '../providers/VariableTimelinePanel';

export function registerShowVariableTimelineCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('devxray.showVariableTimeline', (node?: VariableTreeNode) => {
    if (!node) return;
    VariableTimelinePanel.show(node.variableName, context.extensionUri);
  });
}
