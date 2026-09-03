// src/core/logger.ts
// ─────────────────────────────────────────────────────────────────────────────
// Centralised logging service wrapping the VS Code Output Channel.
// NEVER use console.log in production code — use Logger instead.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Singleton logger that writes to the "CodeScope" VS Code Output Channel.
 *
 * @example
 * Logger.info('ProjectScanner', 'Scan started', { fileCount: 42 });
 * Logger.error('analyzeProject', 'Scan failed', error);
 */
export class Logger {
  private static _channel: vscode.OutputChannel | undefined;
  private static _level: LogLevel = 'info';

  /** Called once from extension.ts activate() */
  static initialize(channel: vscode.OutputChannel, level: LogLevel = 'info'): void {
    Logger._channel = channel;
    Logger._level = level;
  }

  /** Dispose the output channel on extension deactivation */
  static dispose(): void {
    Logger._channel?.dispose();
    Logger._channel = undefined;
  }

  static debug(source: string, message: string, data?: unknown): void {
    Logger._log('debug', source, message, data);
  }

  static info(source: string, message: string, data?: unknown): void {
    Logger._log('info', source, message, data);
  }

  static warn(source: string, message: string, data?: unknown): void {
    Logger._log('warn', source, message, data);
  }

  static error(source: string, message: string, data?: unknown): void {
    Logger._log('error', source, message, data);
  }

  private static _log(
    level: LogLevel,
    source: string,
    message: string,
    data?: unknown,
  ): void {
    if (LOG_LEVEL_RANK[level] < LOG_LEVEL_RANK[Logger._level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelTag = level.toUpperCase().padEnd(5);
    const dataString = data !== undefined ? `\n  ${JSON.stringify(data, null, 2)}` : '';
    const line = `[${timestamp}] [${levelTag}] [${source}] ${message}${dataString}`;

    Logger._channel?.appendLine(line);

    // Mirror errors to console in development (VS Code Extension Development Host)
    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(line);
    }
  }
}
