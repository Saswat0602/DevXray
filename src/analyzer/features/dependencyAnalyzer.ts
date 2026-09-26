// src/analyzer/features/dependencyAnalyzer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Analyzes package.json dependencies and cross-references them with the GraphStore.
// ─────────────────────────────────────────────────────────────────────────────

import * as path from 'path';
import * as fs from 'fs';
import { GraphStore } from '../../core/graphStore';
import { NpmRegistryService } from '../../services/NpmRegistryService';

export interface DependencyInfo {
  name: string;
  currentVersion: string;
  latestVersion: string | null;
  isOutdated: boolean;
  dependentFilePaths: string[];
}

export class DependencyAnalyzer {
  public static async analyze(
    workspaceRoot: string,
    graphStore: GraphStore,
    npmService: NpmRegistryService
  ): Promise<DependencyInfo[]> {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return [];
    }

    let pkgJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | undefined;
    try {
      const content = await fs.promises.readFile(packageJsonPath, 'utf8');
      pkgJson = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    } catch (e) {
      return [];
    }

    const deps = {
      ...(pkgJson?.dependencies || {}),
      ...(pkgJson?.devDependencies || {}),
    };

    const results: DependencyInfo[] = [];

    // Process each dependency
    for (const [name, versionObj] of Object.entries(deps)) {
      const currentVersion = String(versionObj).replace(/^[^0-9]+/, ''); // strip ^, ~ etc
      
      // Query GraphStore for usage
      // The FileIndexer names external imports as 'pkg::[packageName]'
      const pkgId = `pkg::${name}`;
      const inboundEdges = graphStore.getInboundEdges(pkgId);
      
      const dependentFilePaths = Array.from(new Set(inboundEdges.map(e => e.filePath)));

      // Fetch latest version
      const latestVersion = await npmService.getLatestVersion(name);
      
      let isOutdated = false;
      if (latestVersion && currentVersion) {
        // Simple string comparison for basic semantic versioning check
        // Real semver is better, but this works for Phase 5 MVP
        isOutdated = this._isVersionOutdated(currentVersion, latestVersion);
      }

      results.push({
        name,
        currentVersion: String(versionObj), // Keep the original string (e.g. ^1.0.0)
        latestVersion,
        isOutdated,
        dependentFilePaths,
      });
    }

    return results;
  }

  private static _isVersionOutdated(current: string, latest: string): boolean {
    const parse = (v: string): number[] => v.split('.').map(Number);
    const cParts = parse(current);
    const lParts = parse(latest);
    
    for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
      const c = cParts[i] || 0;
      const l = lParts[i] || 0;
      if (l > c) return true;
      if (c > l) return false;
    }
    return false;
  }
}
