// src/commands/trackVariable.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.trackVariable
// Grabs the selected text in the active editor and adds it to VariableTracker.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Registry } from '../core/registry';
import { VariableTracker } from '../analyzer/debugger/variableTracker';

export function registerTrackVariableCommand(context: vscode.ExtensionContext): vscode.Disposable {
  void context;

  return vscode.commands.registerCommand('devxray.trackVariable', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showErrorMessage('DevXray: No active editor.');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      void vscode.window.showErrorMessage('DevXray: Please select a variable name to track.');
      return;
    }

    const variableName = editor.document.getText(selection).trim();
    if (!variableName) {
      void vscode.window.showErrorMessage('DevXray: Invalid variable name.');
      return;
    }

    const tracker = Registry.has(VariableTracker) ? Registry.get(VariableTracker) : undefined;
    if (tracker) {
      tracker.trackVariable(variableName);
      void vscode.window.showInformationMessage(`DevXray: Now tracking '${variableName}'`);
      
      // Ensure the sidebar panel is focused so the user can see it
      void vscode.commands.executeCommand('devxray.variableTree.focus');
    }
  });
}
