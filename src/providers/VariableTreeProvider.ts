// src/providers/VariableTreeProvider.ts
// ─────────────────────────────────────────────────────────────────────────────
// TreeDataProvider for the Variable Tracker sidebar view.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Registry } from '../core/registry';
import { VariableTracker } from '../analyzer/debugger/variableTracker';

export class VariableTreeNode extends vscode.TreeItem {
  constructor(
    public readonly variableName: string,
    public readonly latestValue: string | undefined
  ) {
    super(variableName, vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'devxrayTrackedVariable';
    this.iconPath = new vscode.ThemeIcon('symbol-variable');
    
    if (latestValue === undefined) {
      this.description = 'waiting for debug session...';
      this.tooltip = `${variableName} (no data yet)`;
    } else {
      this.description = latestValue;
      this.tooltip = `${variableName} = ${latestValue}`;
    }

    this.command = {
      command: 'devxray.showVariableTimeline',
      title: 'Show Timeline',
      arguments: [this]
    };
  }
}

export class VariableTreeProvider implements vscode.TreeDataProvider<VariableTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<VariableTreeNode | undefined | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    const tracker = Registry.has(VariableTracker) ? Registry.get(VariableTracker) : undefined;
    if (tracker) {
      tracker.onDidChangeTracking(() => {
        this.refresh();
      });
    }
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: VariableTreeNode): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: VariableTreeNode): vscode.ProviderResult<VariableTreeNode[]> {
    if (element) {
      return []; // No nested children for now
    }

    const tracker = Registry.has(VariableTracker) ? Registry.get(VariableTracker) : undefined;
    if (!tracker) {
      return [];
    }

    const variables = tracker.getTrackedVariables();
    
    return variables.map(name => {
      const latestValue = tracker.getLatestValue(name);
      return new VariableTreeNode(name, latestValue);
    });
  }
}
