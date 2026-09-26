// src/providers/AiAssistantPanel.ts
// ─────────────────────────────────────────────────────────────────────────────
// Webview panel for the AI Chat Assistant.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import * as vscode from 'vscode';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';
import { ContextBuilder } from '../analyzer/ai/contextBuilder';
import { LlmService, ChatMessage } from '../analyzer/ai/LlmService';
import { Logger } from '../core/logger';

export class AiAssistantPanel {
  public static currentPanel: AiAssistantPanel | undefined;
  public static readonly viewType = 'devxrayAiAssistant';

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  
  // The conversation history
  private _messages: ChatMessage[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    AiAssistantPanel.currentPanel = this;

    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    };

    this._panel.webview.html = this._getHtmlForWebview();

    // Listen for panel closure
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'sendMessage':
            await this._handleUserMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );

    // Initialize conversation
    this._initializeConversation();
  }

  public static show(extensionUri: vscode.Uri): void {
    if (AiAssistantPanel.currentPanel) {
      AiAssistantPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      AiAssistantPanel.viewType,
      'Ask DevXray (AI)',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    new AiAssistantPanel(panel, extensionUri);
  }

  public dispose(): void {
    AiAssistantPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _initializeConversation(): void {
    const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
    if (!graphStore) {
      this._updateWebview([{ role: 'assistant', content: 'GraphStore is not initialized. Please analyze the project first.' }]);
      return;
    }

    const systemContext = ContextBuilder.buildContext(graphStore);
    
    // Set the system prompt with context
    this._messages.push({
      role: 'system',
      content: `You are DevXray, an expert AI coding assistant. You have deep knowledge of the user's project structure based on the following context.\n\n${systemContext}\n\nAnswer the user's questions clearly and concisely. Format code blocks properly.`
    });

    // Send initial greeting
    const greeting: ChatMessage = { role: 'assistant', content: "Hello! I'm DevXray AI. I've analyzed your project's architecture. What would you like to know?" };
    this._messages.push(greeting);
    this._updateWebview();
  }

  private async _handleUserMessage(text: string): Promise<void> {
    if (!text.trim()) return;

    // Add user message
    this._messages.push({ role: 'user', content: text });
    this._updateWebview(undefined, true); // Show loading state

    try {
      const response = await LlmService.generateResponse(this._messages);
      this._messages.push({ role: 'assistant', content: response });
    } catch (error: any) {
      Logger.error('AiAssistant', `Failed to generate response: ${error.message}`);
      this._messages.push({ role: 'assistant', content: `**Error:** ${error.message}` });
    }

    this._updateWebview();
  }

  private _updateWebview(overrideMessages?: ChatMessage[], isLoading = false): void {
    const messagesToRender = overrideMessages ?? this._messages.filter(m => m.role !== 'system');
    void this._panel.webview.postMessage({ command: 'renderMessages', messages: messagesToRender, isLoading });
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevXray AI</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-foreground);
    }
    #chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message {
      padding: 12px 16px;
      border-radius: 8px;
      max-width: 85%;
      line-height: 1.5;
    }
    .message.user {
      align-self: flex-end;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .message.assistant {
      align-self: flex-start;
      background-color: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-widget-border);
    }
    .message pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .message code {
      font-family: var(--vscode-editor-font-family);
    }
    #input-container {
      padding: 16px;
      border-top: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
    }
    #message-input {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      resize: none;
      font-family: var(--vscode-font-family);
    }
    #message-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .loading {
      align-self: flex-start;
      padding: 12px 16px;
      font-style: italic;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div id="chat-container"></div>
  <div id="input-container">
    <textarea id="message-input" rows="3" placeholder="Ask about your codebase... (Press Enter to send, Shift+Enter for new line)"></textarea>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');

    // Simple markdown renderer for code blocks and bold text
    function renderMarkdown(text) {
      let html = text.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
      html = html.replace(/\\n/g, '<br/>');
      // Very basic code block handling
      html = html.replace(/\\x60\\x60\\x60[\\s\\S]*?\\n([\\s\\S]*?)\\x60\\x60\\x60/g, '<pre><code>$1</code></pre>');
      html = html.replace(/\\x60([^\\x60]+)\\x60/g, '<code>$1</code>');
      return html;
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'renderMessages') {
        chatContainer.innerHTML = '';
        message.messages.forEach(msg => {
          const div = document.createElement('div');
          div.className = 'message ' + msg.role;
          div.innerHTML = renderMarkdown(msg.content);
          chatContainer.appendChild(div);
        });

        if (message.isLoading) {
          const loadingDiv = document.createElement('div');
          loadingDiv.className = 'loading';
          loadingDiv.textContent = 'DevXray is thinking...';
          chatContainer.appendChild(loadingDiv);
        }

        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = messageInput.value;
        if (text.trim()) {
          vscode.postMessage({ command: 'sendMessage', text });
          messageInput.value = '';
        }
      }
    });
  </script>
</body>
</html>`;
  }
}
