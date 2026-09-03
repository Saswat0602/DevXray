// src/analyzer/codebase/projectScanner.ts
// ─────────────────────────────────────────────────────────────────────────────
// Scans the workspace directory for TypeScript/JavaScript source files.
// Pure Node.js — zero VS Code dependencies (Architectural Law 2).
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import { AnalysisResult, ok, err } from '../../core/types/AnalysisResult';
import { CodeScopeError } from '../../core/errors/CodeScopeError';

export interface ScannerOptions {
  /** Glob-like patterns or directory names to exclude */
  excludePatterns?: string[];
  /** Maximum file size in kilobytes (default: 500) */
  maxFileSizeKb?: number;
  /** File extensions to include (default: ts, tsx, js, jsx, mjs, cjs) */
  supportedExtensions?: string[];
}

export type ScanProgressCallback = (scannedCount: number, currentFilePath: string) => void;

const DEFAULT_SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const DEFAULT_EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.vscode',
  '.idea',
  'dist',
  'out',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
]);

export class ProjectScanner {
  /**
   * Recursively scans a workspace directory and returns an array of absolute file paths.
   */
  public static async scan(
    workspaceRoot: string,
    options: ScannerOptions = {},
    onProgress?: ScanProgressCallback,
  ): Promise<AnalysisResult<string[]>> {
    try {
      const stat = await fs.promises.stat(workspaceRoot);
      if (!stat.isDirectory()) {
        return err(
          new CodeScopeError('SCAN_FAILED', `Workspace root is not a directory: ${workspaceRoot}`),
        );
      }

      const supportedExts = options.supportedExtensions
        ? new Set(options.supportedExtensions.map((e) => (e.startsWith('.') ? e : `.${e}`)))
        : DEFAULT_SUPPORTED_EXTENSIONS;

      const maxBytes = (options.maxFileSizeKb ?? 500) * 1024;
      const excludeMatchers = this._compileExcludeMatchers(options.excludePatterns);

      const collectedFiles: string[] = [];

      await this._walkDirectory(
        workspaceRoot,
        workspaceRoot,
        supportedExts,
        maxBytes,
        excludeMatchers,
        collectedFiles,
        onProgress,
      );

      return ok(collectedFiles);
    } catch (error) {
      return err(CodeScopeError.from(error, 'SCAN_FAILED'));
    }
  }

  private static async _walkDirectory(
    dir: string,
    root: string,
    supportedExts: Set<string>,
    maxBytes: number,
    excludeMatchers: RegExp[],
    results: string[],
    onProgress?: ScanProgressCallback,
  ): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      // Unreadable directory (permissions etc.) — skip gracefully
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(root, fullPath);

      if (entry.isDirectory()) {
        if (DEFAULT_EXCLUDE_DIRS.has(entry.name)) {
          continue;
        }
        if (this._isExcluded(relativePath, excludeMatchers)) {
          continue;
        }
        await this._walkDirectory(
          fullPath,
          root,
          supportedExts,
          maxBytes,
          excludeMatchers,
          results,
          onProgress,
        );
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!supportedExts.has(ext)) {
          continue;
        }
        if (this._isExcluded(relativePath, excludeMatchers)) {
          continue;
        }

        try {
          const fileStat = await fs.promises.stat(fullPath);
          if (fileStat.size > maxBytes) {
            continue; // Skip files exceeding size threshold
          }
        } catch {
          continue;
        }

        results.push(fullPath);
        if (onProgress) {
          onProgress(results.length, fullPath);
        }
      }
    }
  }

  private static _compileExcludeMatchers(patterns?: string[]): RegExp[] {
    if (!patterns || patterns.length === 0) {
      return [];
    }

    return patterns.map((pat) => {
      // Normalize slashes
      const cleaned = pat.replace(/\\/g, '/');
      // Convert basic glob wildcards (* and **) to regex
      const regexStr = cleaned
        .replace(/[.+^${}()|[\]]/g, '\\$&') // escape regex specials
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      return new RegExp(regexStr);
    });
  }

  private static _isExcluded(relativePath: string, matchers: RegExp[]): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    for (const matcher of matchers) {
      if (matcher.test(normalized)) {
        return true;
      }
    }
    return false;
  }
}
