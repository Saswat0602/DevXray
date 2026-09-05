// src/providers/CodebaseTreeProvider.ts
// ─────────────────────────────────────────────────────────────────────────────
// TreeDataProvider for the Codebase Explorer sidebar view.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import * as path from 'path';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';
import { CodeEntity, CodeEntityKind } from '../core/types/CodeEntity';

type TreeNodeType = 'folder' | 'file' | 'entity';

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
    
    this.contextValue = type === 'folder' ? 'devxrayFolder' : type === 'file' ? 'devxrayFile' : 'devxrayEntity';
    this.tooltip = type === 'folder' || type === 'file' ? filePath : `${label} (${entity?.kind})`;
    
    // Icon based on kind
    if (type === 'folder') {
      this.iconPath = new vscode.ThemeIcon('folder');
    } else if (type === 'file') {
      this.iconPath = new vscode.ThemeIcon('file-code');
    } else if (entity) {
      this.iconPath = this._getIconForKind(entity.kind);
    }

    // Command to open the entity (only for files and entities)
    if (type !== 'folder') {
      this.command = {
        command: 'devxray.openEntity',
        title: 'Open',
        arguments: [this.filePath, this.startLine],
      };
    }
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

    if (!element || element.type === 'folder') {
      // Build directory tree
      const dirPath = element ? element.filePath : (this._workspaceRoot || '/');
      const children = new Map<string, { type: TreeNodeType; fullPath: string }>();

      for (const entity of graph.entities.values()) {
        if (entity.kind === 'file') {
          // Check if file is inside this dirPath
          if (entity.filePath.startsWith(dirPath)) {
            const relPath = entity.filePath.substring(dirPath.length);
            const parts = relPath.split(/[/\\]/).filter(Boolean);
            
            if (parts.length > 0) {
              const name = parts[0];
              const isFolder = parts.length > 1;
              const fullPath = path.join(dirPath, name);
              
              if (!children.has(name)) {
                children.set(name, { type: isFolder ? 'folder' : 'file', fullPath });
              }
            }
          }
        }
      }

      const nodes: EntityTreeNode[] = [];
      for (const [name, info] of children.entries()) {
        const fileEntity = info.type === 'file' ? graphStore?.getEntitiesByFile(info.fullPath).find(e => e.kind === 'file') : undefined;
        nodes.push(
          new EntityTreeNode(
            name,
            info.type,
            info.fullPath,
            fileEntity,
            vscode.TreeItemCollapsibleState.Collapsed,
            info.fullPath,
            1
          )
        );
      }

      // Sort folders first, then alphabetically
      nodes.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.label.localeCompare(b.label);
      });
      return nodes;
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
