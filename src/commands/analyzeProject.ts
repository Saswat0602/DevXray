// src/commands/analyzeProject.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.analyzeProject
// Thin orchestrator — validates context, runs scan, reports progress.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { CodeScopeError } from '../core/errors/CodeScopeError';

/**
 * Registers the `devxray.analyzeProject` command.
 * Returns a Disposable to be pushed into context.subscriptions.
 */
export function registerAnalyzeProjectCommand(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('devxray.analyzeProject', async () => {
    Logger.info('analyzeProject', 'Command invoked');

    // ── Guard: workspace must be open ────────────────────────────────────────
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

    // ── Progress notification ────────────────────────────────────────────────
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'CodeScope',
        cancellable: true,
      },
      async (progress, token) => {
        try {
          progress.report({ increment: 0, message: 'Starting analysis…' });

          // Phase 2 will plug real scanner here.
          // For Phase 1, we simulate progress to validate the wiring.
          await simulateScan(progress, token, workspaceRoot);

          if (!token.isCancellationRequested) {
            void vscode.window.showInformationMessage(
              'DevXray: Analysis complete! (Phase 2 will populate real results.)',
            );
            Logger.info('analyzeProject', 'Analysis complete');
          }
        } catch (e) {
          const error = CodeScopeError.from(e, 'SCAN_FAILED');
          Logger.error('analyzeProject', 'Analysis failed', {
            code: error.code,
            message: error.message,
          });
          void vscode.window.showErrorMessage(
            `DevXray: Analysis failed — ${error.message}. See Output for details.`,
          );
        }
      },
    );

    void context;
  });
}

// ── Placeholder: simulate scan progress (remove in Phase 2) ─────────────────

async function simulateScan(
  progress: vscode.Progress<{ increment: number; message: string }>,
  token: vscode.CancellationToken,
  _workspaceRoot: string,
): Promise<void> {
  const steps = [
    { increment: 20, message: 'Scanning files…' },
    { increment: 20, message: 'Parsing imports…' },
    { increment: 20, message: 'Building dependency graph…' },
    { increment: 20, message: 'Indexing functions & classes…' },
    { increment: 20, message: 'Finalising…' },
  ];

  for (const step of steps) {
    if (token.isCancellationRequested) {
      return;
    }
    progress.report(step);
    await delay(400);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
