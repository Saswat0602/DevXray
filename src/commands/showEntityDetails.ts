// src/commands/showEntityDetails.ts
// ─────────────────────────────────────────────────────────────────────────────
// Command handler: devxray.showEntityDetails
// Gathers dependency data for an entity and opens the Details Webview.
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { Logger } from '../core/logger';
import { Registry } from '../core/registry';
import { GraphStore } from '../core/graphStore';
import { EntityDetailsPanel } from '../providers/EntityDetailsPanel';
import { EntityDetailsData, EntityEdgeDetails } from '../core/types/EntityDetailsData';
import { DependencyEdge } from '../core/types/Dependency';

export function registerShowEntityDetailsCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(
    'devxray.showEntityDetails',
    (entityId?: string) => {
      // If invoked from TreeView context menu, it might receive an EntityTreeNode
      let targetId = entityId;
      if (entityId && typeof entityId === 'object') {
        const node = entityId as { id: string };
        targetId = node.id;
      }

      if (!targetId || typeof targetId !== 'string') {
        Logger.warn('showEntityDetails', 'Invoked without valid entity ID');
        return;
      }

      Logger.debug('showEntityDetails', 'Command invoked', { targetId });

      const graphStore = Registry.has(GraphStore) ? Registry.get(GraphStore) : undefined;
      if (!graphStore) {
        void vscode.window.showErrorMessage('DevXray: GraphStore not available.');
        return;
      }

      const targetEntity = graphStore.getEntity(targetId);
      if (!targetEntity) {
        void vscode.window.showErrorMessage(`DevXray: Entity ${targetId} not found in graph.`);
        return;
      }

      const rawInbound = graphStore.getInboundEdges(targetId);
      const rawOutbound = graphStore.getOutboundEdges(targetId);

      const mapEdge = (edge: DependencyEdge, isOutbound: boolean): EntityEdgeDetails => {
        const otherId = isOutbound ? edge.to : edge.from;
        const otherEntity = graphStore.getEntity(otherId);
        return { edge, targetEntity: otherEntity };
      };

      const data: EntityDetailsData = {
        targetEntity,
        inboundEdges: rawInbound.map(e => mapEdge(e, false)),
        outboundEdges: rawOutbound.map(e => mapEdge(e, true)),
      };

      EntityDetailsPanel.createOrShow(context.extensionUri, data);
    }
  );
}
