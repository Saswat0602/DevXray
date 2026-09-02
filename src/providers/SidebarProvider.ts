// src/providers/SidebarProvider.ts
// ─────────────────────────────────────────────────────────────────────────────
// WebviewViewProvider for the DevXray sidebar panel.
// Uses VS Code Codicons for all iconography — no emoji.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../core/types/WebviewMessage';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'devxray.sidebarView';

  private _view: vscode.WebviewView | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  // ── WebviewViewProvider ────────────────────────────────────────────────────

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((raw: unknown) => {
      this._handleWebviewMessage(raw as WebviewToExtensionMessage);
    });

    Logger.info('SidebarProvider', 'Webview resolved');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public postMessage(message: ExtensionToWebviewMessage): void {
    if (this._view === undefined) {
      Logger.warn('SidebarProvider', 'postMessage called before view resolved');
      return;
    }
    void this._view.webview.postMessage(message);
  }

  public get isReady(): boolean {
    return this._view !== undefined;
  }

  // ── Message routing ────────────────────────────────────────────────────────

  private _handleWebviewMessage(message: WebviewToExtensionMessage): void {
    Logger.debug('SidebarProvider', `Webview → host: ${message.type}`);

    switch (message.type) {
      case 'READY':
        Logger.info('SidebarProvider', 'Webview ready');
        break;

      case 'REQUEST_ANALYZE_PROJECT':
        void vscode.commands.executeCommand('codescope.analyzeProject');
        break;

      case 'REQUEST_ANALYZE_FILE':
        void vscode.commands.executeCommand('codescope.analyzeFile', message.payload.filePath);
        break;

      case 'REQUEST_SCAN_DEPENDENCIES':
        void vscode.commands.executeCommand('codescope.scanDependencies');
        break;

      case 'OPEN_FILE': {
        const uri = vscode.Uri.file(message.payload.filePath);
        void vscode.window.showTextDocument(uri, {
          selection: new vscode.Range(
            message.payload.line - 1, 0,
            message.payload.line - 1, 0,
          ),
        });
        break;
      }

      default: {
        const _exhaustive: never = message;
        Logger.warn('SidebarProvider', 'Unhandled message', _exhaustive);
      }
    }
  }

  // ── HTML ───────────────────────────────────────────────────────────────────

  private _buildHtml(webview: vscode.Webview): string {
    const csp = webview.cspSource;

    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css',
      ),
    );

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; font-src ${csp}; style-src ${csp} 'unsafe-inline'; script-src 'unsafe-inline';" />
  <link href="${codiconsUri}" rel="stylesheet" />
  <title>CodeScope</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* scrollable region */
    .scroll {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .scroll::-webkit-scrollbar { width: 4px; }
    .scroll::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 4px;
    }

    /* ── header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 11px 12px 9px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .logo-mark {
      width: 22px; height: 22px;
      border-radius: 5px;
      background: linear-gradient(135deg, #5c6bc0, #26c6da);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .logo-mark .codicon { font-size: 13px; color: #fff; }
    .logo-name {
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.09em; text-transform: uppercase;
    }
    .version {
      margin-left: auto;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }

    /* ── health card ── */
    .card {
      margin: 10px 10px 6px;
      border-radius: 5px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .card-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px 11px 6px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .card-title {
      font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--vscode-descriptionForeground);
    }
    .card-score {
      font-size: 13px; font-weight: 700;
    }
    .card-score sub {
      font-size: 10px; font-weight: 400;
      color: var(--vscode-descriptionForeground);
    }

    /* metric rows */
    .metric {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 11px;
    }
    .metric:last-child { padding-bottom: 8px; }
    .metric-label {
      display: flex; align-items: center; gap: 5px;
      width: 94px; flex-shrink: 0;
      font-size: 11px; color: var(--vscode-descriptionForeground);
    }
    .metric-label .codicon { font-size: 12px; opacity: 0.65; }
    .track {
      flex: 1; height: 3px; border-radius: 2px;
      background: var(--vscode-panel-border);
      overflow: hidden;
    }
    .fill {
      height: 100%; border-radius: 2px;
      background: var(--vscode-progressBar-background);
      width: 0%; transition: width 0.55s ease;
    }
    .fill.dim { background: var(--vscode-panel-border); }
    .metric-val {
      width: 22px; text-align: right; flex-shrink: 0;
      font-size: 10px; color: var(--vscode-descriptionForeground);
    }

    /* ── status strip ── */
    .status {
      display: flex; align-items: center; gap: 7px;
      margin: 0 10px 8px;
      padding: 6px 10px;
      border-radius: 4px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
    }
    .dot {
      width: 6px; height: 6px; border-radius: 50%;
      flex-shrink: 0;
      background: var(--vscode-descriptionForeground);
    }
    .dot.ready { background: var(--vscode-terminal-ansiGreen, #4caf50); }
    .dot.busy  {
      background: var(--vscode-terminal-ansiYellow, #f0a500);
      animation: blink 1s ease-in-out infinite;
    }
    @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.2;} }

    .status-text {
      font-size: 11px; color: var(--vscode-descriptionForeground);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ── primary button ── */
    .btn-primary {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin: 0 10px 2px;
      width: calc(100% - 20px);
      padding: 7px 12px;
      border-radius: 4px; border: none; cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: 12px; font-weight: 600; letter-spacing: 0.02em;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      transition: background 0.12s;
    }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn-primary .codicon { font-size: 13px; }

    /* ── divider ── */
    .divider { height: 1px; background: var(--vscode-panel-border); margin: 6px 0; }

    /* ── section label ── */
    .section-label {
      padding: 8px 13px 3px;
      font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--vscode-descriptionForeground);
    }

    /* ── nav item ── */
    .nav-item {
      display: flex; align-items: center; gap: 9px;
      padding: 6px 13px;
      font-family: var(--vscode-font-family);
      font-size: 12px; color: var(--vscode-foreground);
      background: transparent; border: none; cursor: pointer;
      width: 100%; text-align: left;
      transition: background 0.1s;
    }
    .nav-item:hover { background: var(--vscode-list-hoverBackground); }
    .nav-item .codicon {
      font-size: 14px; color: var(--vscode-icon-foreground);
      flex-shrink: 0; opacity: 0.8;
    }
    .nav-label { flex: 1; }
    .nav-badge {
      font-size: 10px; padding: 1px 5px; border-radius: 3px;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-panel-border);
    }

    /* disabled items */
    .nav-item.off {
      opacity: 0.4; cursor: default; pointer-events: none;
    }

    /* ── footer ── */
    .footer {
      flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px 13px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .footer-text { font-size: 10px; color: var(--vscode-descriptionForeground); }
    .footer-btn {
      font-family: var(--vscode-font-family);
      font-size: 10px; color: var(--vscode-textLink-foreground);
      background: none; border: none; cursor: pointer; padding: 0;
    }
    .footer-btn:hover { text-decoration: underline; }
  </style>
</head>
<body>

  <!-- header -->
  <div class="header">
    <div class="logo-mark"><i class="codicon codicon-telescope"></i></div>
    <span class="logo-name">DevXray</span>
    <span class="version">v0.1.0 · saswat</span>
  </div>

  <div class="scroll">

    <!-- health card -->
    <div class="card" style="margin-top:12px">
      <div class="card-head">
        <span class="card-title">Project Health</span>
        <span class="card-score" id="overall">— <sub>/ 100</sub></span>
      </div>
      <div class="metric">
        <span class="metric-label"><i class="codicon codicon-zap"></i>Performance</span>
        <div class="track"><div class="fill dim" id="bar-perf"></div></div>
        <span class="metric-val" id="val-perf">—</span>
      </div>
      <div class="metric">
        <span class="metric-label"><i class="codicon codicon-trash"></i>Dead Code</span>
        <div class="track"><div class="fill dim" id="bar-dead"></div></div>
        <span class="metric-val" id="val-dead">—</span>
      </div>
      <div class="metric">
        <span class="metric-label"><i class="codicon codicon-package"></i>Deps</span>
        <div class="track"><div class="fill dim" id="bar-deps"></div></div>
        <span class="metric-val" id="val-deps">—</span>
      </div>
    </div>

    <!-- status -->
    <div class="status">
      <div class="dot" id="dot"></div>
      <span class="status-text" id="status">No analysis — click Analyze Project</span>
    </div>

    <!-- primary cta -->
    <button class="btn-primary" onclick="doAnalyze()">
      <i class="codicon codicon-search"></i>
      Analyze Project
    </button>

    <div class="divider"></div>
    <div class="section-label">Modules</div>

    <button class="nav-item off">
      <i class="codicon codicon-type-hierarchy"></i>
      <span class="nav-label">Codebase Explorer</span>
      <span class="nav-badge">Phase 3</span>
    </button>

    <button class="nav-item off">
      <i class="codicon codicon-warning"></i>
      <span class="nav-label">Dead Code Hunter</span>
      <span class="nav-badge">Phase 4</span>
    </button>

    <button class="nav-item" onclick="doScanDeps()">
      <i class="codicon codicon-package"></i>
      <span class="nav-label">Dependency Detective</span>
      <span class="nav-badge">Phase 5</span>
    </button>

    <button class="nav-item off">
      <i class="codicon codicon-dashboard"></i>
      <span class="nav-label">Performance Analyzer</span>
      <span class="nav-badge">Phase 6</span>
    </button>

    <button class="nav-item off">
      <i class="codicon codicon-debug-alt"></i>
      <span class="nav-label">Variable Tracker</span>
      <span class="nav-badge">Phase 7</span>
    </button>

    <div class="divider"></div>

    <button class="nav-item off">
      <i class="codicon codicon-sparkle"></i>
      <span class="nav-label">Ask CodeScope (AI)</span>
      <span class="nav-badge">Phase 8</span>
    </button>

  </div>

  <!-- footer -->
  <div class="footer">
    <span class="footer-text">DevXray · Phase 1</span>
    <button class="footer-btn" onclick="post('REQUEST_ANALYZE_PROJECT')">View Logs</button>
  </div>

  <script>
    const api = acquireVsCodeApi();

    function post(type, payload) {
      api.postMessage(payload !== undefined ? { type, payload } : { type });
    }

    function setState(dotClass, text) {
      document.getElementById('dot').className = 'dot ' + dotClass;
      document.getElementById('status').textContent = text;
    }

    function setBar(barId, valId, pct) {
      const fill = document.getElementById(barId);
      if (pct === null) {
        fill.style.width = '0%';
        fill.classList.add('dim');
        document.getElementById(valId).textContent = '—';
      } else {
        fill.style.width = pct + '%';
        fill.classList.remove('dim');
        document.getElementById(valId).textContent = String(pct);
      }
    }

    function doAnalyze() {
      setState('busy', 'Starting analysis…');
      post('REQUEST_ANALYZE_PROJECT');
    }

    function doScanDeps() {
      setState('busy', 'Scanning dependencies…');
      post('REQUEST_SCAN_DEPENDENCIES');
    }

    window.addEventListener('message', ({ data: m }) => {
      switch (m.type) {
        case 'SCAN_PROGRESS':
          setState('busy', m.payload.label + '  ' + m.payload.percent + '%');
          break;
        case 'SCAN_COMPLETE':
          setState('ready', m.payload.fileCount + ' files · ' + m.payload.entityCount + ' entities');
          break;
        case 'SCAN_ERROR':
          setState('', 'Error: ' + m.payload.message);
          break;
      }
    });

    post('READY');
  </script>

</body>
</html>`;
  }
}
