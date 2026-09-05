// src/providers/EntityDetailsPanel.ts
// ─────────────────────────────────────────────────────────────────────────────
// Webview panel for displaying CodeEntity details (inbound/outbound dependencies).
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { EntityDetailsData, EntityEdgeDetails } from '../core/types/EntityDetailsData';
import { DependencyEdge } from '../core/types/Dependency';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';

export class EntityDetailsPanel {
  public static currentPanel: EntityDetailsPanel | undefined;
  public static readonly viewType = 'devxray.entityDetails';

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _currentData: EntityDetailsData | undefined;

  public static createOrShow(extensionUri: vscode.Uri, data: EntityDetailsData): void {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (EntityDetailsPanel.currentPanel) {
      EntityDetailsPanel.currentPanel.update(data);
      EntityDetailsPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      EntityDetailsPanel.viewType,
      'Entity Details',
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );

    EntityDetailsPanel.currentPanel = new EntityDetailsPanel(panel, data);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    data: EntityDetailsData
  ) {
    this._panel = panel;

    this.update(data);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message: { type: string; filePath: string; line: number; entityId: string }) => {
        switch (message.type) {
          case 'OPEN_FILE':
            void vscode.commands.executeCommand('devxray.openEntity', message.filePath, message.line);
            break;
          case 'SHOW_DETAILS':
            void vscode.commands.executeCommand('devxray.showEntityDetails', message.entityId);
            break;
        }
      },
      null,
      this._disposables
    );

    const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
    if (graphStore) {
      this._disposables.push(
        new vscode.Disposable(
          graphStore.onDidChangeGraph(() => {
            this._refreshData(graphStore);
          })
        )
      );
    }
  }

  private _refreshData(graphStore: GraphStore): void {
    if (!this._currentData) return;
    
    const targetId = this._currentData.targetEntity.id;
    const targetEntity = graphStore.getEntity(targetId);
    
    if (!targetEntity) {
      // Entity was deleted, close the panel
      this._panel.dispose();
      return;
    }

    const rawInbound = graphStore.getInboundEdges(targetId);
    const rawOutbound = graphStore.getOutboundEdges(targetId);

    const mapEdge = (edge: DependencyEdge, isOutbound: boolean): EntityEdgeDetails => {
      const otherId = isOutbound ? edge.to : edge.from;
      const otherEntity = graphStore.getEntity(otherId);
      return { edge, targetEntity: otherEntity };
    };

    const newData: EntityDetailsData = {
      targetEntity,
      inboundEdges: rawInbound.map(e => mapEdge(e, false)),
      outboundEdges: rawOutbound.map(e => mapEdge(e, true)),
    };

    this.update(newData);
  }

  public update(data: EntityDetailsData): void {
    this._currentData = data;
    this._panel.title = `Details: ${data.targetEntity.name}`;
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, data);
  }

  public dispose(): void {
    EntityDetailsPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, data: EntityDetailsData): string {
    const csp = webview.cspSource;
    
    // We will use standard VS Code theme variables
    
    // Helper to generate the list items
    const generateList = (edges: import('../core/types/EntityDetailsData').EntityEdgeDetails[], title: string, emptyMsg: string): string => {
      if (edges.length === 0) {
        return `
          <div class="section">
            <div class="section-title">${title} (0)</div>
            <div class="empty-state">${emptyMsg}</div>
          </div>
        `;
      }
      
      let html = `
        <div class="section">
          <div class="section-title">${title} (${edges.length})</div>
          <div class="list">
      `;
      
      for (const item of edges) {
        const edge = item.edge;
        const target = item.targetEntity;
        const kindBadge = `<span class="badge badge-${edge.kind}">${edge.kind}</span>`;
        
        let label = target ? target.name : edge.to;
        if (target && target.kind === 'file') {
          label = target.name;
        } else if (target) {
          label = `${target.name} (${target.kind})`;
        }
        
        const clickable = target && target.kind !== 'export' && !target.id.startsWith('pkg::');
        
        html += `
          <div class="list-item">
            <div class="item-header">
              <span class="item-name">${label}</span>
              ${kindBadge}
            </div>
            <div class="item-location" onclick="openFile('${edge.filePath.replace(/\\/g, '\\\\')}', ${edge.line})">
              ${edge.filePath.split(/[/\\]/).pop()}:${edge.line}
            </div>
            ${clickable ? `
              <button class="btn" onclick="showDetails('${target.id}')">Inspect</button>
            ` : ''}
          </div>
        `;
      }
      
      html += `
          </div>
        </div>
      `;
      return html;
    };

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Entity Details</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
    }
    
    /* Header */
    .header {
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .entity-name {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .entity-meta {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      display: flex;
      gap: 12px;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
      color: var(--vscode-descriptionForeground);
    }
    
    /* Sections */
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }
    .empty-state {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 12px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
    }
    
    /* Lists */
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .list-item {
      padding: 12px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .item-name {
      font-weight: 600;
    }
    .item-location {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      margin-bottom: 8px;
    }
    .item-location:hover {
      text-decoration: underline;
    }
    
    /* Buttons */
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    }
    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="entity-name">${data.targetEntity.name}</div>
    <div class="entity-meta">
      <span class="badge">${data.targetEntity.kind}</span>
      <span class="location" style="cursor:pointer; color:var(--vscode-textLink-foreground);" onclick="openFile('${data.targetEntity.filePath.replace(/\\/g, '\\\\')}', ${data.targetEntity.startLine})">
        ${data.targetEntity.filePath.split(/[/\\]/).pop()} : ${data.targetEntity.startLine}
      </span>
    </div>
  </div>

  <div class="layout">
    ${generateList(data.inboundEdges, 'Inbound Dependencies (Callers)', 'No internal inbound dependencies found.')}
    ${generateList(data.outboundEdges, 'Outbound Dependencies (Callees)', 'No outbound dependencies found.')}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    function openFile(filePath, line) {
      vscode.postMessage({ type: 'OPEN_FILE', filePath, line });
    }
    
    function showDetails(entityId) {
      vscode.postMessage({ type: 'SHOW_DETAILS', entityId });
    }
  </script>
</body>
</html>
    `;
  }
}
