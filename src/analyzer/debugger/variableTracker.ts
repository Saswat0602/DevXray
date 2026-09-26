// src/analyzer/debugger/variableTracker.ts
// ─────────────────────────────────────────────────────────────────────────────
// Hooks into the VS Code Debug Adapter Protocol to track variable values over time.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

import * as vscode from 'vscode';
import { Logger } from '../../core/logger';

export interface VariableHistoryEntry {
  timestamp: number;
  value: string;
}

export class VariableTracker implements vscode.DebugAdapterTrackerFactory {
  // A set of variable names currently being tracked
  private readonly _trackedVariables = new Set<string>();
  
  // History of values for each tracked variable
  private readonly _history = new Map<string, VariableHistoryEntry[]>();

  private _onDidChangeTracking = new vscode.EventEmitter<void>();
  public readonly onDidChangeTracking = this._onDidChangeTracking.event;

  public trackVariable(name: string): void {
    if (!this._trackedVariables.has(name)) {
      this._trackedVariables.add(name);
      this._history.set(name, []);
      Logger.info('VariableTracker', `Started tracking: ${name}`);
      this._onDidChangeTracking.fire();
    }
  }

  public untrackVariable(name: string): void {
    if (this._trackedVariables.has(name)) {
      this._trackedVariables.delete(name);
      this._history.delete(name);
      Logger.info('VariableTracker', `Stopped tracking: ${name}`);
      this._onDidChangeTracking.fire();
    }
  }

  public getTrackedVariables(): string[] {
    return Array.from(this._trackedVariables);
  }

  public getHistory(name: string): VariableHistoryEntry[] {
    return this._history.get(name) ?? [];
  }

  public getLatestValue(name: string): string | undefined {
    const history = this._history.get(name);
    if (!history || history.length === 0) return undefined;
    return history[history.length - 1].value;
  }

  // ── DebugAdapterTrackerFactory Implementation ────────────────────────────

  public createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
    Logger.info('VariableTracker', `Attached to debug session: ${session.name}`);
    
    // Return the tracker for this session
    return {
      onDidSendMessage: (message: any) => { void this._handleDAPMessage(session, message); }
    };
  }

  private async _handleDAPMessage(session: vscode.DebugSession, message: any): Promise<void> {
    // We only care about events
    if (message.type !== 'event') return;

    // Specifically, when the debugger stops (breakpoint, step, pause)
    if (message.event === 'stopped') {
      const threadId = message.body?.threadId;
      if (typeof threadId !== 'number') return;

      try {
        // 1. Get the top stack frame for this thread
        const stackTraceResponse = await session.customRequest('stackTrace', { threadId, levels: 1 });
        const frameId = stackTraceResponse?.stackFrames?.[0]?.id;
        
        if (typeof frameId !== 'number') return;

        // 2. Evaluate all tracked variables in this frame
        for (const variableName of this._trackedVariables) {
          try {
            const evaluateResponse = await session.customRequest('evaluate', {
              expression: variableName,
              frameId,
              context: 'watch'
            });

            this._recordValue(variableName, evaluateResponse.result);
          } catch (e) {
            // DAP customRequest throws if evaluation fails (e.g., ReferenceError / out of scope)
            this._recordValue(variableName, '<out of scope>');
          }
        }
      } catch (err) {
        Logger.warn('VariableTracker', 'Failed to retrieve stack frames during stopped event', err);
      }
    }
  }

  private _recordValue(name: string, value: string): void {
    const history = this._history.get(name);
    if (history) {
      // Don't record consecutive identical values
      if (history.length > 0 && history[history.length - 1].value === value) {
        return;
      }
      history.push({ timestamp: Date.now(), value });
      this._onDidChangeTracking.fire();
    }
  }
}
