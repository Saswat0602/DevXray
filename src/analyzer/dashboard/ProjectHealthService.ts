// src/analyzer/dashboard/ProjectHealthService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Service to calculate project health scores for the Dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { GraphStore } from '../../core/graphStore';
import { DeadCodeAnalyzer } from '../features/deadCodeAnalyzer';
import { DependencyInfo } from '../features/dependencyAnalyzer';

export interface ProjectHealthScores {
  overall: number;
  performance: number;
  deadCode: number;
  dependencies: number;
}

export class ProjectHealthService {
  /**
   * Computes the 0-100 health scores based on the current state of the workspace.
   */
  public static computeScores(
    graphStore: GraphStore,
    deps: DependencyInfo[]
  ): ProjectHealthScores {
    const graph = graphStore.getGraph();
    if (!graph || graph.entities.size === 0) {
      return { overall: 0, performance: 0, deadCode: 0, dependencies: 0 };
    }

    // ── 1. Dead Code Score ──
    // Penalty based on the ratio of dead entities to total entities
    const deadEntities = DeadCodeAnalyzer.analyze(graphStore);
    const deadCount = deadEntities.length;
    const totalEntities = graph.entities.size;
    const deadRatio = totalEntities > 0 ? deadCount / totalEntities : 0;
    // 0 dead code = 100, 20% dead code = 0
    let deadCodeScore = Math.max(0, 100 - (deadRatio * 500));
    deadCodeScore = Math.round(deadCodeScore);

    // ── 2. Performance Score ──
    // Penalty based on the number of performance issues per file
    const perfIssues = graphStore.getTotalPerformanceIssues();
    const fileCount = graph.fileCount;
    // e.g., 2 issues per file on average drops score to 0
    const perfRatio = fileCount > 0 ? perfIssues / fileCount : 0;
    let perfScore = Math.max(0, 100 - (perfRatio * 50));
    perfScore = Math.round(perfScore);

    // ── 3. Dependency Score ──
    // Penalty based on outdated dependencies
    let depsScore = 100;
    if (deps && deps.length > 0) {
      const outdatedCount = deps.filter(d => d.isOutdated).length;
      const outdatedRatio = outdatedCount / deps.length;
      // 50% outdated = 0 score
      depsScore = Math.max(0, 100 - (outdatedRatio * 200));
    }
    depsScore = Math.round(depsScore);

    // ── 4. Overall Score ──
    const overall = Math.round((deadCodeScore + perfScore + depsScore) / 3);

    return {
      overall,
      performance: perfScore,
      deadCode: deadCodeScore,
      dependencies: depsScore
    };
  }
}
