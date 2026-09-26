// src/analyzer/ai/LlmService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Handles communication with the LLM API (OpenRouter or Local).
// Uses Node's native HTTP/HTTPS modules for zero external dependencies.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions */

import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import { Logger } from '../../core/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmService {
  /**
   * Sends a chat completion request to the configured AI provider.
   */
  public static async generateResponse(messages: ChatMessage[]): Promise<string> {
    const config = vscode.workspace.getConfiguration('devxray.ai');
    const provider = config.get<string>('provider', 'openrouter');
    const model = config.get<string>('model', 'openai/gpt-4o-mini');
    
    if (provider === 'local') {
      const endpoint = config.get<string>('localEndpoint', 'http://127.0.0.1:11434/v1/chat/completions');
      return this._postRequest(endpoint, { model, messages }, false);
    } else {
      const apiKey = config.get<string>('apiKey', '');
      if (!apiKey) {
        throw new Error('OpenRouter API key is missing. Please set devxray.ai.apiKey in settings.');
      }
      return this._postRequest('https://openrouter.ai/api/v1/chat/completions', { model, messages }, true, apiKey);
    }
  }

  private static _postRequest(urlStr: string, body: any, isHttps: boolean, apiKey?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
          'HTTP-Referer': 'https://github.com/saswatranjan/devxray', // Required by OpenRouter
          'X-Title': 'DevXray IDE Extension' // Required by OpenRouter
        }
      };

      const req = (isHttps ? https : http).request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              const message = parsed.choices?.[0]?.message?.content;
              if (message) {
                resolve(message);
              } else {
                reject(new Error('Invalid response format from API.'));
              }
            } catch (e) {
              reject(new Error(`Failed to parse API response: ${e}`));
            }
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        Logger.error('LlmService', `Network request failed: ${err.message}`);
        reject(err);
      });

      req.write(JSON.stringify(body));
      req.end();
    });
  }
}
