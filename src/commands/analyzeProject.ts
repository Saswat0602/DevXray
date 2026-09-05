// src/commands/analyzeProject.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.analyzeProject
// Orchestrates workspace scanning, AST indexing, and dependency graph assembly.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';
import { SidebarProvider } from '../providers/SidebarProvider';
import { ProjectScanner } from '../analyzer/codebase/projectScanner';
import { FileIndexer } from '../analyzer/codebase/fileIndexer';
import { serializeGraph } from '../core/types/WebviewMessage';
import { CodeScopeError } from '../core/errors/CodeScopeError';

/**
 * Registers the `devxray.analyzeProject` command.
 */
export function registerAnalyzeProjectCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  void context;

  return vscode.commands.registerCommand('devxray.analyzeProject', async () => {
    Logger.info('analyzeProject', 'Command invoked');

    // ── 1. Guard: workspace must be open ────────────────────────────────────
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      void vscode.window.showErrorMessage(
        'DevXray: Please open a workspace folder before running an analysis.',
      );
      Logger.warn('analyzeProject', 'No workspace folder open');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    Logger.info('analyzeProject', 'Starting analysis', { workspaceRoot });

    // Retrieve services from Registry
    const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
    const sidebarProvider = Registry.has(SidebarProvider)
      ? Registry.get(SidebarProvider)
      : undefined;

    // Retrieve user configurations
    const config = vscode.workspace.getConfiguration('devxray');
    const excludePatterns = config.get<string[]>('excludePatterns', []);
    const maxFileSizeKb = config.get<number>('maxFileSizeKb', 500);

    const startTime = Date.now();

    // ── 2. Run analysis with progress reporting ─────────────────────────────
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'DevXray',
        cancellable: true,
      },
      async (progress, token) => {
        try {
          // ── Step 1: Scan files ──
          progress.report({ increment: 5, message: 'Scanning project files…' });
          sidebarProvider?.postMessage({
            type: 'SCAN_PROGRESS',
            payload: { percent: 10, label: 'Scanning files…' },
          });

          const scanResult = await ProjectScanner.scan(
            workspaceRoot,
            { excludePatterns, maxFileSizeKb },
            (count) => {
              if (count % 20 === 0) {
                progress.report({ message: `Discovered ${count} source files…` });
              }
            },
          );

          if (!scanResult.ok) {
            throw scanResult.error;
          }

          const filePaths = scanResult.data;
          if (token.isCancellationRequested) {
            return;
          }

          if (filePaths.length === 0) {
            void vscode.window.showWarningMessage(
              'DevXray: No supported TypeScript or JavaScript source files found in workspace.',
            );
            sidebarProvider?.postMessage({
              type: 'SCAN_COMPLETE',
              payload: { fileCount: 0, entityCount: 0, edgeCount: 0, durationMs: 0 },
            });
            return;
          }

          Logger.info('analyzeProject', `Found ${filePaths.length} source files to index`);

          // ── Step 2: Index AST in files ──
          progress.report({ increment: 25, message: `Indexing AST across ${filePaths.length} files…` });
          sidebarProvider?.postMessage({
            type: 'SCAN_PROGRESS',
            payload: { percent: 35, label: `Parsing AST (${filePaths.length} files)…` },
          });

          const indexResult = await FileIndexer.indexFiles(filePaths, (indexedCount) => {
            const pct = Math.min(
              75,
              35 + Math.round((indexedCount / filePaths.length) * 40),
            );
            sidebarProvider?.postMessage({
              type: 'SCAN_PROGRESS',
              payload: {
                percent: pct,
                label: `Indexed ${indexedCount}/${filePaths.length} files`,
              },
            });
          });

          if (!indexResult.ok) {
            throw indexResult.error;
          }

          if (token.isCancellationRequested) {
            return;
          }

          // ── Step 3: Build Dependency Graph ──
          progress.report({ increment: 50, message: 'Assembling dependency graph…' });
          sidebarProvider?.postMessage({
            type: 'SCAN_PROGRESS',
            payload: { percent: 85, label: 'Assembling dependency graph…' },
          });

          // ── Step 4: Store Graph & Update UI ──
          if (graphStore) {
            graphStore.setIndexResults(indexResult.data);
            await graphStore.saveToStorage(context);
          }

          const graph = graphStore?.getGraph();
          if (!graph) {
             throw new Error('Graph could not be built.');
          }
          const durationMs = Date.now() - startTime;

          const entityCount = graph.entities.size;
          const edgeCount = graph.edges.length;

          sidebarProvider?.postMessage({
            type: 'SCAN_COMPLETE',
            payload: {
              fileCount: graph.fileCount,
              entityCount,
              edgeCount,
              durationMs,
            },
          });

          sidebarProvider?.postMessage({
            type: 'GRAPH_UPDATED',
            payload: serializeGraph(graph),
          });

          progress.report({ increment: 20, message: 'Done!' });

          Logger.info('analyzeProject', 'Analysis finished successfully', {
            fileCount: graph.fileCount,
            entityCount,
            edgeCount,
            durationMs,
          });

          void vscode.window.showInformationMessage(
            `DevXray: Analysis complete! ${graph.fileCount} files, ${entityCount} entities, ${edgeCount} dependencies mapped in ${durationMs}ms.`,
          );
        } catch (e) {
          const error = CodeScopeError.from(e, 'SCAN_FAILED');
          Logger.error('analyzeProject', 'Analysis failed', {
            code: error.code,
            message: error.message,
          });

          sidebarProvider?.postMessage({
            type: 'SCAN_ERROR',
            payload: { message: error.message, code: error.code },
          });

          void vscode.window.showErrorMessage(
            `DevXray: Analysis failed — ${error.message}. See Output channel for details.`,
          );
        }
      },
    );
  });
}
