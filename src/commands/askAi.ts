// src/commands/askAi.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.askAi
// Opens the AI Assistant panel.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { AiAssistantPanel } from '../providers/AiAssistantPanel';

export function registerAskAiCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('devxray.askAi', () => {
    AiAssistantPanel.show(context.extensionUri);
  });
}
