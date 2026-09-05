// src/providers/CodebaseTreeProvider.ts
// ─────────────────────────────────────────────────────────────────────────────
// TreeDataProvider for the Codebase Explorer sidebar view.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import * as path from 'path';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';
import { CodeEntity, CodeEntityKind } from '../core/types/CodeEntity';

type TreeNodeType = 'file' | 'entity';

export class EntityTreeNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: TreeNodeType,
    public readonly id: string, // File path or Entity ID
    public readonly entity: CodeEntity | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath: string,
    public readonly startLine: number,
  ) {
    super(label, collapsibleState);
    
    this.contextValue = type === 'file' ? 'devxrayFile' : 'devxrayEntity';
    this.tooltip = type === 'file' ? filePath : `${label} (${entity?.kind})`;
    
    // Icon based on kind
    if (type === 'file') {
      this.iconPath = new vscode.ThemeIcon('file-code');
    } else if (entity) {
      this.iconPath = this._getIconForKind(entity.kind);
    }

    // Command to open the entity
    this.command = {
      command: 'devxray.openEntity',
      title: 'Open',
      arguments: [this.filePath, this.startLine],
    };
  }

  private _getIconForKind(kind: CodeEntityKind): vscode.ThemeIcon {
    switch (kind) {
      case 'class':
        return new vscode.ThemeIcon('symbol-class');
      case 'function':
      case 'arrow-function':
        return new vscode.ThemeIcon('symbol-method');
      case 'interface':
        return new vscode.ThemeIcon('symbol-interface');
      case 'enum':
        return new vscode.ThemeIcon('symbol-enum');
      case 'type':
        return new vscode.ThemeIcon('symbol-type-parameter');
      case 'variable':
        return new vscode.ThemeIcon('symbol-variable');
      case 'export':
        return new vscode.ThemeIcon('symbol-property');
      default:
        return new vscode.ThemeIcon('symbol-misc');
    }
  }
}

export class CodebaseTreeProvider implements vscode.TreeDataProvider<EntityTreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<EntityTreeNode | undefined | void> =
    new vscode.EventEmitter<EntityTreeNode | undefined | void>();
  public readonly onDidChangeTreeData: vscode.Event<EntityTreeNode | undefined | void> =
    this._onDidChangeTreeData.event;

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

  public getTreeItem(element: EntityTreeNode): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: EntityTreeNode): EntityTreeNode[] {
    const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
    const graph = graphStore?.getGraph();

    if (!graph || graph.fileCount === 0) {
      // If no graph, return empty (or a dummy node, but returning empty is standard)
      return [];
    }

    if (!element) {
      // Root level: Group by file
      // Since it's a simple list, we will just return all unique files
      // To improve UX, we could group by folder later, but flat list of files is fine for Phase 3 MVP.
      const filePaths = new Set<string>();
      for (const entity of graph.entities.values()) {
        if (entity.kind === 'file') {
          filePaths.add(entity.filePath);
        }
      }

      const fileNodes: EntityTreeNode[] = [];
      for (const filePath of filePaths) {
        let label = filePath;
        if (this._workspaceRoot) {
          label = path.relative(this._workspaceRoot, filePath);
        }

        // Get file entity if it exists
        const fileEntity = graphStore?.getEntitiesByFile(filePath).find(e => e.kind === 'file');

        fileNodes.push(
          new EntityTreeNode(
            label,
            'file',
            filePath,
            fileEntity,
            vscode.TreeItemCollapsibleState.Collapsed,
            filePath,
            1
          )
        );
      }

      // Sort alphabetically by label
      fileNodes.sort((a, b) => a.label.localeCompare(b.label));
      return fileNodes;
    } else if (element.type === 'file') {
      // Child level: Entities within a file
      const entities = graphStore?.getEntitiesByFile(element.filePath) || [];
      const childNodes: EntityTreeNode[] = [];

      for (const entity of entities) {
        if (entity.kind === 'file') {
          continue; // Skip the file entity itself
        }
        
        childNodes.push(
          new EntityTreeNode(
            entity.name,
            'entity',
            entity.id,
            entity,
            vscode.TreeItemCollapsibleState.None, // Leaf nodes
            entity.filePath,
            entity.startLine
          )
        );
      }
      
      // Sort entities by line number
      childNodes.sort((a, b) => a.startLine - b.startLine);
      return childNodes;
    }

    return [];
  }
}
