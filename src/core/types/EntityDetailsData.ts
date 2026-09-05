// src/core/types/EntityDetailsData.ts
// ─────────────────────────────────────────────────────────────────────────────
// Types for data passed to the Entity Details webview.
// ─────────────────────────────────────────────────────────────────────────────

import { CodeEntity } from './CodeEntity';
import { DependencyEdge } from './Dependency';

export interface EntityEdgeDetails {
  edge: DependencyEdge;
  targetEntity?: CodeEntity;
}

export interface EntityDetailsData {
  targetEntity: CodeEntity;
  inboundEdges: EntityEdgeDetails[];
  outboundEdges: EntityEdgeDetails[];
}
