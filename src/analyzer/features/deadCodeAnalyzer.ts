// src/analyzer/features/deadCodeAnalyzer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Queries the GraphStore to find entities with zero inbound dependencies.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { GraphStore } from '../../core/graphStore';
import { CodeEntity } from '../../core/types/CodeEntity';

export class DeadCodeAnalyzer {
  public static analyze(graphStore: GraphStore): CodeEntity[] {
    const graph = graphStore.getGraph();
    if (!graph) {
      return [];
    }

    const config = vscode.workspace.getConfiguration('devxray');
    const entryPoints = config.get<string[]>('entryPoints', []);
    const ignoredIds = new Set(config.get<string[]>('ignoredDeadCode', []));

    const deadEntities: CodeEntity[] = [];

    for (const entity of graph.entities.values()) {
      if (ignoredIds.has(entity.id)) {
        continue;
      }

      // 1. Is this file an entry point?
      const isEntryPoint = entryPoints.some(pattern => {
        const cleanPattern = pattern.replace(/\*/g, '');
        return entity.filePath.includes(cleanPattern);
      });

      if (isEntryPoint) {
        continue;
      }

      // 2. Check inbound edges
      const inboundEdges = graphStore.getInboundEdges(entity.id);

      // 3. For local (non-exported) functions/variables, they are dead if they have no inbound edges
      // from *within the same file*. But since GraphStore edges are universal, 0 edges means 0 calls.
      if (inboundEdges.length === 0) {
        // Special case: we shouldn't flag variables that might be used structurally or locally 
        // without a clear call edge, but for Phase 4 we flag everything with 0 edges.
        
        // Skip package/external entities
        if (entity.id.startsWith('pkg::') || entity.kind === 'export') {
          continue;
        }

        deadEntities.push(entity);
      }
    }

    return deadEntities;
  }
}
