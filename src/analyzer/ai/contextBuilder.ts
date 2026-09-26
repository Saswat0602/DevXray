// src/analyzer/ai/contextBuilder.ts
// ─────────────────────────────────────────────────────────────────────────────
// Generates a highly compressed structural context string from the GraphStore.
// ─────────────────────────────────────────────────────────────────────────────

import { GraphStore } from '../../core/graphStore';
import { CodeEntity } from '../../core/types/CodeEntity';

export class ContextBuilder {
  /**
   * Serializes the project graph into a concise, token-efficient markdown format.
   * To save context size, we only include FILES and top-level entities, plus 
   * their dependencies (edges).
   */
  public static buildContext(graphStore: GraphStore): string {
    const graph = graphStore.getGraph();
    if (!graph) {
      return 'Context: No codebase graph available.';
    }

    let markdown = '## Codebase Context\n\n';
    markdown += `Total Files: ${graph.fileCount}, Total Entities: ${graph.entities.size}, Total Edges: ${graph.edges.length}\n\n`;

    // Group entities by file
    const files = new Map<string, CodeEntity[]>();
    for (const entity of graph.entities.values()) {
      if (!files.has(entity.filePath)) {
        files.set(entity.filePath, []);
      }
      files.get(entity.filePath)?.push(entity);
    }

    markdown += '### Project Structure & Exports\n';

    for (const [filePath, entities] of files.entries()) {
      markdown += `- **${filePath}**\n`;

      // Only list interesting entities to save tokens (e.g., Classes, Functions, Interfaces)
      const notable = entities.filter(e => 
        e.kind === 'class' || 
        e.kind === 'function' || 
        e.kind === 'interface'
      );

      for (const e of notable) {
        markdown += `  - \`${e.name}\` (${e.kind})\n`;
      }
    }

    markdown += '\n### Dependency Edges (Imports/Calls)\n';
    // To save tokens, we might only list edges between files or notable entities
    const fileEdges = new Set<string>();

    for (const edge of graph.edges) {
      const source = graph.entities.get(edge.from);
      const target = graph.entities.get(edge.to);
      if (source && target) {
        if (source.filePath !== target.filePath) {
          fileEdges.add(`${source.filePath} -> ${target.filePath} (via ${edge.kind})`);
        }
      }
    }

    for (const edgeString of fileEdges) {
      markdown += `- ${edgeString}\n`;
    }

    return markdown;
  }
}
