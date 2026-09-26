// src/extension.ts
// ─────────────────────────────────────────────────────────────────────────────
// DevXray — Extension Entry Point
//
// This file is the ONLY place where:
//   1. Services are instantiated
//   2. Services are registered in Registry
//   3. Disposables are collected
//
// Keep this file thin. Delegate all real work to commands, providers, analyzers.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from './core/logger';
import { Registry } from './core/registry';
import { SidebarProvider } from './providers/SidebarProvider';
import { registerAnalyzeProjectCommand } from './commands/analyzeProject';
import { registerAnalyzeFileCommand } from './commands/analyzeFile';
import { registerScanDependenciesCommand } from './commands/scanDependencies';
import { registerOpenEntityCommand } from './commands/openEntity';
import { registerShowEntityDetailsCommand } from './commands/showEntityDetails';
import { registerIgnoreDeadCodeCommand } from './commands/ignoreDeadCode';
import { registerDeleteDeadCodeCommand } from './commands/deleteDeadCode';
import { registerUpdatePackageCommand } from './commands/updatePackage';

import { GraphStore } from './core/graphStore';
import { NpmRegistryService } from './services/NpmRegistryService';
import { CodebaseTreeProvider } from './providers/CodebaseTreeProvider';
import { DeadCodeTreeProvider } from './providers/DeadCodeTreeProvider';
import { DependencyTreeProvider } from './providers/DependencyTreeProvider';
import { FileWatcherService } from './services/FileWatcherService';

// ── Extension lifecycle ──────────────────────────────────────────────────────

/**
 * Called by VS Code when the extension is first activated.
 * Activation event: `onStartupFinished` (see package.json)
 */
export function activate(context: vscode.ExtensionContext): void {
  // ── 1. Initialise logging ────────────────────────────────────────────────
  const outputChannel = vscode.window.createOutputChannel('DevXray');
  const logLevel = vscode.workspace
    .getConfiguration('devxray')
    .get<'debug' | 'info' | 'warn' | 'error'>('logLevel', 'info');
  Logger.initialize(outputChannel, logLevel);
  context.subscriptions.push({ dispose: () => Logger.dispose() });

  const packageInfo = context.extension.packageJSON as { version?: string } | undefined;
  Logger.info('extension', 'DevXray activating…', {
    version: packageInfo?.version ?? '0.1.0',
  });

  // ── 2. Instantiate core services & providers ────────────────────────────
  const graphStore = new GraphStore();
  const npmService = new NpmRegistryService();
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  const fileWatcher = new FileWatcherService();

  // Load previous state if available
  void graphStore.loadFromStorage(context);

  if (vscode.workspace.workspaceFolders?.[0]) {
    fileWatcher.startWatching(vscode.workspace.workspaceFolders[0].uri.fsPath);
  }

  // ── 3. Register services in Registry ────────────────────────────────────
  Registry.register(GraphStore, graphStore);
  Registry.register(NpmRegistryService, npmService);
  Registry.register(SidebarProvider, sidebarProvider);
  Registry.register(FileWatcherService, fileWatcher);

  context.subscriptions.push(fileWatcher);

  // ── 4. Register VS Code contribution points ──────────────────────────────

  // Sidebar webview view
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.VIEW_ID,
      sidebarProvider,
      {
        webviewOptions: {
          // Keeps the webview alive when the sidebar is hidden.
          // Memory cost: yes. UX cost of losing state: higher.
          retainContextWhenHidden: true,
        },
      },
    ),
  );

  // Commands
  context.subscriptions.push(
    registerAnalyzeProjectCommand(context),
    registerAnalyzeFileCommand(context),
    registerScanDependenciesCommand(context),
    registerOpenEntityCommand(context),
    registerShowEntityDetailsCommand(context),
    registerIgnoreDeadCodeCommand(context),
    registerDeleteDeadCodeCommand(context),
    registerUpdatePackageCommand(context)
  );

  // Tree Views
  const codebaseTreeProvider = new CodebaseTreeProvider();
  const deadCodeTreeProvider = new DeadCodeTreeProvider();
  const dependencyTreeProvider = new DependencyTreeProvider();
  
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('devxray.codebaseTree', codebaseTreeProvider),
    vscode.window.registerTreeDataProvider('devxray.deadCodeTree', deadCodeTreeProvider),
    vscode.window.registerTreeDataProvider('devxray.dependencyTree', dependencyTreeProvider)
  );

  Logger.info('extension', 'DevXray activated successfully');
}

/**
 * Called by VS Code when the extension is deactivated (workspace closed, VS Code quit, etc.)
 */
export function deactivate(): void {
  Logger.info('extension', 'DevXray deactivating…');
  // Individual disposables are cleaned up via context.subscriptions automatically.
  // Add any extra teardown here if needed in later phases.
}
