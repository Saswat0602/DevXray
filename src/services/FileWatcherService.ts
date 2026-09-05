// src/services/FileWatcherService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Watches the workspace for file changes and incrementally updates the GraphStore.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../core/logger';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';
import { FileIndexer } from '../analyzer/codebase/fileIndexer';

export class FileWatcherService implements vscode.Disposable {
  private _watcher: vscode.FileSystemWatcher | undefined;
  private _disposables: vscode.Disposable[] = [];
  private _excludePatterns: string[] = [];

  constructor() {
    this._updateConfig();

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('devxray.excludePatterns')) {
        this._updateConfig();
      }
    }, null, this._disposables);
  }

  private _updateConfig(): void {
    const config = vscode.workspace.getConfiguration('devxray');
    this._excludePatterns = config.get<string[]>('excludePatterns', []);
  }

  private _isExcluded(filePath: string): boolean {
    const isExcludedByGlob = this._excludePatterns.some((pattern) => {
      // Basic manual glob check (simplified)
      // For real use we'd use minimatch, but we'll do a simple substring check for now
      const cleanPattern = pattern.replace(/\*/g, '');
      return filePath.includes(cleanPattern);
    });

    return isExcludedByGlob || filePath.includes('node_modules') || filePath.includes('.git');
  }

  private _isSupportedExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
  }

  public startWatching(workspaceRoot: string): void {
    if (this._watcher) {
      this._watcher.dispose();
    }

    // Watch all files in workspace
    const pattern = new vscode.RelativePattern(workspaceRoot, '**/*');
    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this._watcher.onDidChange((uri) => this._handleFileChange(uri), this, this._disposables);
    this._watcher.onDidCreate((uri) => this._handleFileChange(uri), this, this._disposables);
    this._watcher.onDidDelete((uri) => this._handleFileDelete(uri), this, this._disposables);

    Logger.info('FileWatcherService', 'Started watching for file changes', { workspaceRoot });
  }

  private async _handleFileChange(uri: vscode.Uri): Promise<void> {
    const filePath = uri.fsPath;

    if (this._isExcluded(filePath) || !this._isSupportedExtension(filePath)) {
      return;
    }

    Logger.debug('FileWatcherService', 'File changed, updating index', { filePath });

    try {
      const indexResult = await FileIndexer.indexFile(filePath);
      if (indexResult.ok) {
        const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
        if (graphStore) {
          graphStore.updateFile(indexResult.data);
        }
      } else {
        Logger.warn('FileWatcherService', 'Failed to index changed file', indexResult.error);
      }
    } catch (e) {
      Logger.error('FileWatcherService', 'Error processing file change', e);
    }
  }

  private _handleFileDelete(uri: vscode.Uri): void {
    const filePath = uri.fsPath;
    
    if (this._isExcluded(filePath) || !this._isSupportedExtension(filePath)) {
      return;
    }

    Logger.debug('FileWatcherService', 'File deleted, removing from index', { filePath });

    const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
    if (graphStore) {
      graphStore.removeFile(filePath);
    }
  }

  public dispose(): void {
    if (this._watcher) {
      this._watcher.dispose();
    }
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}
