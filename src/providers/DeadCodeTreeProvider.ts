// src/providers/DeadCodeTreeProvider.ts
// ─────────────────────────────────────────────────────────────────────────────
// TreeDataProvider for the Dead Code Hunter sidebar view.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import * as path from 'path';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';
import { CodeEntity, CodeEntityKind } from '../core/types/CodeEntity';
import { DeadCodeAnalyzer } from '../analyzer/features/deadCodeAnalyzer';

export class DeadCodeTreeNode extends vscode.TreeItem {
  constructor(
    public readonly entity: CodeEntity,
    public readonly workspaceRoot: string | undefined
  ) {
    super(entity.name, vscode.TreeItemCollapsibleState.None);
    
    this.contextValue = 'devxrayDeadCode';
    
    const relPath = workspaceRoot ? path.relative(workspaceRoot, entity.filePath) : entity.filePath;
    this.description = `${relPath}:${entity.startLine}`;
    this.tooltip = `0 references found for ${entity.name}`;
    
    this.iconPath = this._getIconForKind(entity.kind);

    this.command = {
      command: 'devxray.openEntity',
      title: 'Open',
      arguments: [entity.filePath, entity.startLine],
    };
  }

  private _getIconForKind(kind: CodeEntityKind): vscode.ThemeIcon {
    switch (kind) {
      case 'file': return new vscode.ThemeIcon('file-code');
      case 'class': return new vscode.ThemeIcon('symbol-class');
      case 'function':
      case 'arrow-function': return new vscode.ThemeIcon('symbol-method');
      case 'interface': return new vscode.ThemeIcon('symbol-interface');
      case 'enum': return new vscode.ThemeIcon('symbol-enum');
      case 'type': return new vscode.ThemeIcon('symbol-type-parameter');
      case 'variable': return new vscode.ThemeIcon('symbol-variable');
      default: return new vscode.ThemeIcon('symbol-misc');
    }
  }
}

export class DeadCodeTreeProvider implements vscode.TreeDataProvider<DeadCodeTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DeadCodeTreeNode | undefined | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  private _workspaceRoot: string | undefined;

  constructor() {
    this._workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
    if (graphStore) {
      graphStore.onDidChangeGraph(() => {
        this.refresh();
      });
    }

    // Refresh when config changes (e.g. user ignores an item)
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('devxray.ignoredDeadCode') || e.affectsConfiguration('devxray.entryPoints')) {
        this.refresh();
      }
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: DeadCodeTreeNode): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: DeadCodeTreeNode): DeadCodeTreeNode[] {
    if (element) {
      return []; // Flat list for now
    }

    const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
    if (!graphStore || !graphStore.getGraph()) {
      return [];
    }

    const deadEntities = DeadCodeAnalyzer.analyze(graphStore);
    
    // Convert to nodes
    return deadEntities.map(e => new DeadCodeTreeNode(e, this._workspaceRoot));
  }
}
