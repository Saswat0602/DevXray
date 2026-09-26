// src/providers/VariableTimelinePanel.ts
// ─────────────────────────────────────────────────────────────────────────────
// Webview panel to display the chronological timeline of a tracked variable.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import * as vscode from 'vscode';
import { Registry } from '../core/registry';
import { VariableTracker } from '../analyzer/debugger/variableTracker';

export class VariableTimelinePanel {
  public static currentPanels = new Map<string, VariableTimelinePanel>();
  public static readonly viewType = 'devxrayVariableTimeline';

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private readonly _variableName: string;

  private constructor(panel: vscode.WebviewPanel, variableName: string) {
    this._panel = panel;
    this._variableName = variableName;
    VariableTimelinePanel.currentPanels.set(variableName, this);

    this._update();

    // Listen for panel closure
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Listen for updates from VariableTracker
    const tracker = Registry.has(VariableTracker) ? Registry.get(VariableTracker) : undefined;
    if (tracker) {
      const sub = tracker.onDidChangeTracking(() => {
        this._update();
      });
      this._disposables.push({ dispose: () => sub.dispose() });
    }
  }

  public static show(variableName: string, extensionUri: vscode.Uri): void {
    const existing = VariableTimelinePanel.currentPanels.get(variableName);
    if (existing) {
      existing._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      VariableTimelinePanel.viewType,
      `Timeline: ${variableName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    new VariableTimelinePanel(panel, variableName);
  }

  public dispose(): void {
    VariableTimelinePanel.currentPanels.delete(this._variableName);
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update(): void {
    const tracker = Registry.has(VariableTracker) ? Registry.get(VariableTracker) : undefined;
    const history = tracker?.getHistory(this._variableName) ?? [];

    this._panel.webview.html = this._getHtmlForWebview(history);
  }

  private _getHtmlForWebview(history: { timestamp: number, value: string }[]): string {
    const items = history.map((h, i) => {
      const time = new Date(h.timestamp).toLocaleTimeString();
      return `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-time">Step ${i + 1} &middot; ${time}</div>
            <div class="timeline-value"><code>${h.value}</code></div>
          </div>
        </div>
      `;
    }).join('');

    const emptyState = `
      <div class="empty">
        <p>No data recorded yet.</p>
        <p style="opacity: 0.7; margin-top: 10px;">Start debugging and step through your code to see value changes.</p>
      </div>
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Variable Timeline</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h2 {
      margin-top: 0;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .timeline {
      margin-top: 20px;
      position: relative;
      padding-left: 20px;
    }
    
    .timeline::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 6px;
      width: 2px;
      background: var(--vscode-panel-border);
    }
    
    .timeline-item {
      position: relative;
      margin-bottom: 20px;
    }
    
    .timeline-dot {
      position: absolute;
      left: -19px;
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--vscode-button-background);
      border: 2px solid var(--vscode-editor-background);
    }
    
    .timeline-time {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    
    .timeline-value {
      background: var(--vscode-textCodeBlock-background);
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid var(--vscode-panel-border);
    }
    
    code {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      white-space: pre-wrap;
    }
    
    .empty {
      margin-top: 40px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <h2>Tracking: <code>${this._variableName}</code></h2>
  ${history.length > 0 ? `<div class="timeline">${items}</div>` : emptyState}
</body>
</html>`;
  }
}
