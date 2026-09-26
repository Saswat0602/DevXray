// src/providers/DependencyTreeProvider.ts
// ─────────────────────────────────────────────────────────────────────────────
// TreeDataProvider for the Dependency Detective sidebar view.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import * as path from 'path';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';
import { NpmRegistryService } from '../services/NpmRegistryService';
import { DependencyAnalyzer, DependencyInfo } from '../analyzer/features/dependencyAnalyzer';

type DependencyTreeNode = DependencyPackageNode | DependencyFileNode;

export class DependencyPackageNode extends vscode.TreeItem {
  constructor(public readonly info: DependencyInfo) {
    super(
      info.name,
      info.dependentFilePaths.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.contextValue = info.isOutdated ? 'devxrayOutdatedPackage' : 'devxrayPackage';

    const usageBadge = `${info.dependentFilePaths.length} file${info.dependentFilePaths.length === 1 ? '' : 's'}`;
    
    if (info.isOutdated && info.latestVersion) {
      this.description = `${usageBadge}  |  ${info.currentVersion} ➔ ${info.latestVersion}`;
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
      this.tooltip = `${info.name} is outdated. Latest is ${info.latestVersion}. Used in ${usageBadge}.`;
    } else {
      this.description = `${usageBadge}  |  ${info.currentVersion}`;
      this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
      this.tooltip = `${info.name} is up to date (${info.currentVersion}). Used in ${usageBadge}.`;
    }
  }
}

export class DependencyFileNode extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly workspaceRoot: string | undefined
  ) {
    const label = workspaceRoot ? path.relative(workspaceRoot, filePath) : filePath;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'devxrayDependencyFile';
    this.iconPath = new vscode.ThemeIcon('file-code');
    this.tooltip = filePath;
    
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(filePath)],
    };
  }
}

export class DependencyTreeProvider implements vscode.TreeDataProvider<DependencyTreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DependencyTreeNode | undefined | void>();
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
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: DependencyTreeNode): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: DependencyTreeNode): Promise<DependencyTreeNode[]> {
    if (!this._workspaceRoot) {
      return [];
    }

    if (element instanceof DependencyPackageNode) {
      // Return file nodes
      return element.info.dependentFilePaths.map(
        fp => new DependencyFileNode(fp, this._workspaceRoot)
      ).sort((a, b) => (a.label as string).localeCompare(b.label as string));
    }

    // Root level: return packages
    const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
    const npmService = Registry.has(NpmRegistryService) ? Registry.get(NpmRegistryService) : undefined;

    if (!graphStore || !npmService || !graphStore.getGraph()) {
      return [];
    }

    const dependencies = await DependencyAnalyzer.analyze(this._workspaceRoot, graphStore, npmService);
    
    const nodes = dependencies.map(d => new DependencyPackageNode(d));
    
    // Sort: outdated first, then alphabetically
    nodes.sort((a, b) => {
      if (a.info.isOutdated && !b.info.isOutdated) return -1;
      if (!a.info.isOutdated && b.info.isOutdated) return 1;
      return a.info.name.localeCompare(b.info.name);
    });

    return nodes;
  }
}
