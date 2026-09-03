// src/analyzer/codebase/dependencyGraph.ts
// ─────────────────────────────────────────────────────────────────────────────
// Assembles the CodebaseGraph from raw FileIndexResult objects.
// Resolves imports, call references, and class heritage across the project.
// Pure Node.js — zero VS Code dependencies (Architectural Law 2).
// ─────────────────────────────────────────────────────────────────────────────

import * as path from 'path';
import { AnalysisResult, ok } from '../../core/types/AnalysisResult';
import { CodeEntity } from '../../core/types/CodeEntity';
import { CodebaseGraph, DependencyEdge } from '../../core/types/Dependency';
import { FileIndexResult } from '../../core/types/FileIndexData';

const RESOLUTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export class DependencyGraphBuilder {
  /**
   * Constructs a connected CodebaseGraph from index results.
   */
  public static build(indexResults: FileIndexResult[]): AnalysisResult<CodebaseGraph> {
    const entities = new Map<string, CodeEntity>();
    const edges: DependencyEdge[] = [];

    // Lookup caches
    const fileByPath = new Map<string, CodeEntity>();
    const entitiesByFile = new Map<string, Map<string, CodeEntity>>();
    const exportsByFile = new Map<string, Map<string, CodeEntity>>();
    const filesWithoutExt = new Map<string, string>(); // '/abs/path/to/foo' -> '/abs/path/to/foo.ts'

    // ── 1. Populate all entities into lookup tables ──────────────────────────
    for (const res of indexResults) {
      const normPath = this._normalizePath(res.filePath);
      fileByPath.set(normPath, res.fileEntity);
      entities.set(res.fileEntity.id, res.fileEntity);

      // Index path without extension for fast import resolution
      const ext = path.extname(normPath);
      const basePath = normPath.slice(0, normPath.length - ext.length);
      filesWithoutExt.set(basePath, normPath);

      const fileEntMap = new Map<string, CodeEntity>();
      const fileExportMap = new Map<string, CodeEntity>();

      for (const entity of res.entities) {
        entities.set(entity.id, entity);
        fileEntMap.set(entity.name, entity);

        if (entity.isExported) {
          fileExportMap.set(entity.name, entity);
        }
      }

      entitiesByFile.set(normPath, fileEntMap);
      exportsByFile.set(normPath, fileExportMap);
    }

    // ── 2. Resolve Import, Call, and Heritage Edges ──────────────────────────
    for (const res of indexResults) {
      const currentFilePath = this._normalizePath(res.filePath);
      const currentFileEntity = res.fileEntity;

      // Map imported localName -> target CodeEntity
      const resolvedImports = new Map<string, CodeEntity>();

      // ── Process Imports ──
      for (const imp of res.imports) {
        const isRelative = imp.moduleSpecifier.startsWith('.') || imp.moduleSpecifier.startsWith('/');

        if (isRelative) {
          const resolvedPath = this._resolveModulePath(
            path.dirname(currentFilePath),
            imp.moduleSpecifier,
            filesWithoutExt,
            fileByPath,
          );

          if (resolvedPath && fileByPath.has(resolvedPath)) {
            const targetFileEntity = fileByPath.get(resolvedPath)!;

            // Edge: file -> imported file
            edges.push({
              from: currentFileEntity.id,
              to: targetFileEntity.id,
              kind: 'import',
              filePath: res.filePath,
              line: imp.line,
            });

            // Map individual specifiers
            const targetExports = exportsByFile.get(resolvedPath);
            if (targetExports) {
              for (const spec of imp.specifiers) {
                const targetEntity = targetExports.get(spec.importedName);
                if (targetEntity) {
                  resolvedImports.set(spec.localName, targetEntity);
                  // Edge: file -> imported symbol
                  edges.push({
                    from: currentFileEntity.id,
                    to: targetEntity.id,
                    kind: 'import',
                    filePath: res.filePath,
                    line: imp.line,
                  });
                }
              }
            }
          }
        } else {
          // External npm package: create/link package entity
          const pkgName = this._extractPackageName(imp.moduleSpecifier);
          const pkgId = `pkg::${pkgName}`;

          if (!entities.has(pkgId)) {
            const pkgEntity: CodeEntity = {
              id: pkgId,
              name: pkgName,
              kind: 'export',
              filePath: 'package.json',
              startLine: 1,
              endLine: 1,
              isExported: true,
            };
            entities.set(pkgId, pkgEntity);
          }

          edges.push({
            from: currentFileEntity.id,
            to: pkgId,
            kind: 'import',
            filePath: res.filePath,
            line: imp.line,
          });
        }
      }

      // ── Process Calls ──
      const currentFileEntities = entitiesByFile.get(currentFilePath);
      for (const call of res.calls) {
        const callerId = call.callerEntityId ?? currentFileEntity.id;

        // Check if callee is in imported symbols
        let targetEntity = resolvedImports.get(call.calleeName);

        // If not imported, check if declared locally in current file
        if (!targetEntity && currentFileEntities) {
          targetEntity = currentFileEntities.get(call.calleeName);
        }

        if (targetEntity && targetEntity.id !== callerId) {
          edges.push({
            from: callerId,
            to: targetEntity.id,
            kind: 'call',
            filePath: res.filePath,
            line: call.line,
          });
        }
      }

      // ── Process Class Heritage (extends / implements) ──
      for (const h of res.heritage) {
        let targetEntity = resolvedImports.get(h.targetName);
        if (!targetEntity && currentFileEntities) {
          targetEntity = currentFileEntities.get(h.targetName);
        }

        if (targetEntity) {
          edges.push({
            from: h.entityId,
            to: targetEntity.id,
            kind: h.kind,
            filePath: res.filePath,
            line: h.line,
          });
        }
      }
    }

    const graph: CodebaseGraph = {
      entities,
      edges,
      scannedAt: new Date(),
      fileCount: indexResults.length,
    };

    return ok(graph);
  }

  private static _resolveModulePath(
    dir: string,
    specifier: string,
    filesWithoutExt: Map<string, string>,
    fileByPath: Map<string, CodeEntity>,
  ): string | undefined {
    const candidateBase = this._normalizePath(path.resolve(dir, specifier));

    // Direct match (e.g. user imported with extension)
    if (fileByPath.has(candidateBase)) {
      return candidateBase;
    }

    // Match with added extensions
    if (filesWithoutExt.has(candidateBase)) {
      return filesWithoutExt.get(candidateBase);
    }

    for (const ext of RESOLUTION_EXTENSIONS) {
      const testPath = `${candidateBase}${ext}`;
      if (fileByPath.has(testPath)) {
        return testPath;
      }
    }

    // Match directory index (e.g. ./services -> ./services/index.ts)
    for (const ext of RESOLUTION_EXTENSIONS) {
      const indexPath = path.join(candidateBase, `index${ext}`);
      if (fileByPath.has(indexPath)) {
        return indexPath;
      }
    }

    return undefined;
  }

  private static _extractPackageName(specifier: string): string {
    if (specifier.startsWith('@')) {
      const parts = specifier.split('/');
      return parts.slice(0, 2).join('/');
    }
    return specifier.split('/')[0];
  }

  private static _normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }
}
