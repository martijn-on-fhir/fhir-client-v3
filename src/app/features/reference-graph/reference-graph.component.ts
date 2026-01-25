import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GraphNode, GraphEdge, VisNode, VisEdge } from '../../core/models/reference-graph.model';
import { EditorStateService } from '../../core/services/editor-state.service';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { ReferenceGraphService } from '../../core/services/reference-graph.service';
import { ToastService } from '../../core/services/toast.service';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';
import { VisNetworkComponent } from '../../shared/components/vis-network/vis-network.component';

/**
 * Reference Graph Component
 *
 * Interactive visualization of FHIR resource relationships.
 * Allows users to explore how resources reference each other
 * through an interactive network graph.
 */
@Component({
  selector: 'app-reference-graph',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    VisNetworkComponent,
    MonacoEditorComponent
  ],
  templateUrl: './reference-graph.component.html',
  styleUrl: './reference-graph.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferenceGraphComponent implements OnInit, OnDestroy {
  @ViewChild('monacoEditor') monacoEditor?: MonacoEditorComponent;
  @ViewChild('visNetwork') visNetwork?: VisNetworkComponent;

  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private graphService = inject(ReferenceGraphService);
  private toastService = inject(ToastService);
  private editorStateService = inject(EditorStateService);
  private logger = this.loggerService.component('ReferenceGraphComponent');

  // Input state
  rootReference = signal<string>(localStorage.getItem('reference-graph-root') || '');
  maxDepth = signal<number>(parseInt(localStorage.getItem('reference-graph-depth') || '2', 10));

  // Loading state
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Graph data
  graphNodes = signal<GraphNode[]>([]);
  graphEdges = signal<GraphEdge[]>([]);
  fetchedResources = signal<Map<string, any>>(new Map());

  // Selection state
  selectedNodeId = signal<string | null>(null);
  selectedResource = signal<any>(null);

  // Computed values for vis-network
  visNodes = computed<VisNode[]>(() =>
    this.graphService.toVisNodes(this.graphNodes())
  );

  visEdges = computed<VisEdge[]>(() =>
    this.graphService.toVisEdges(this.graphEdges())
  );

  // Selected resource JSON for Monaco editor
  selectedResourceJson = computed<string>(() => {
    const resource = this.selectedResource();

    return resource ? JSON.stringify(resource, null, 2) : '';
  });

  // Statistics
  nodeCount = computed(() => this.graphNodes().length);
  edgeCount = computed(() => this.graphEdges().length);

  // Depth options
  depthOptions = [1, 2, 3, 4, 5];

  // Monaco editor for detail
  detailEditor = signal<any>(null);

  ngOnInit(): void {
    this.logger.info('Reference Graph component initialized');

    // Auto-execute if there's a saved reference
    if (this.rootReference()) {
      this.executeGraph();
    }
  }

  ngOnDestroy(): void {
    this.editorStateService.unregisterEditor('/app/reference-graph');
  }

  /**
   * Handle root reference input change
   */
  onRootReferenceChange(value: string): void {
    this.rootReference.set(value);
    localStorage.setItem('reference-graph-root', value);
  }

  /**
   * Handle max depth change
   */
  onMaxDepthChange(value: number): void {
    this.maxDepth.set(value);
    localStorage.setItem('reference-graph-depth', value.toString());
  }

  /**
   * Execute graph building from root reference
   */
  async executeGraph(): Promise<void> {
    const reference = this.rootReference().trim();

    if (!reference) {
      this.error.set('Please enter a resource reference (e.g., Patient/123)');

      return;
    }

    // Validate reference format
    const parsed = this.graphService['parseReference'](reference);

    if (!parsed) {
      this.error.set('Invalid reference format. Use ResourceType/id (e.g., Patient/123)');

      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.selectedNodeId.set(null);
    this.selectedResource.set(null);

    try {
      const result = await firstValueFrom(
        this.graphService.buildGraph(reference, this.maxDepth())
      );

      if (result.nodes.length === 0) {
        this.error.set(`Resource not found: ${reference}`);
        this.graphNodes.set([]);
        this.graphEdges.set([]);
      } else {
        this.graphNodes.set(result.nodes);
        this.graphEdges.set(result.edges);
        this.fetchedResources.set(result.fetchedResources);

        // Auto-select root node
        this.onNodeClick(reference);

        this.logger.info(`Graph built: ${result.nodes.length} nodes, ${result.edges.length} edges`);

        if (result.nodes.length > 50) {
          this.toastService.warning(
            `Large graph with ${result.nodes.length} nodes. Consider reducing depth.`,
            'Performance Warning'
          );
        }
      }
    } catch (err: any) {
      this.logger.error('Failed to build graph:', err);
      this.error.set(err.message || 'Failed to build graph');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle node click - show resource details
   */
  onNodeClick(nodeId: string): void {
    this.selectedNodeId.set(nodeId);

    const resource = this.fetchedResources().get(nodeId);
    this.selectedResource.set(resource || null);

    if (resource) {
      this.logger.debug(`Selected node: ${nodeId}`);
    }
  }

  /**
   * Handle node double-click - expand node
   */
  async onNodeDoubleClick(nodeId: string): Promise<void> {
    const node = this.graphNodes().find(n => n.id === nodeId);

    if (!node) {
      return;
    }

    if (node.expanded) {
      this.toastService.info('Node already expanded', 'Info');

      return;
    }

    if (node.error) {
      this.toastService.warning('Cannot expand - resource not found', 'Warning');

      return;
    }

    this.loading.set(true);

    try {
      const result = await firstValueFrom(
        this.graphService.expandNode(
          nodeId,
          this.graphNodes(),
          this.graphEdges(),
          this.fetchedResources(),
          1
        )
      );

      this.graphNodes.set(result.nodes);
      this.graphEdges.set(result.edges);
      this.fetchedResources.set(result.fetchedResources);

      this.logger.info(`Expanded node ${nodeId}: now ${result.nodes.length} nodes`);
    } catch (err: any) {
      this.logger.error('Failed to expand node:', err);
      this.toastService.error('Failed to expand node', 'Error');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Clear the graph
   */
  clearGraph(): void {
    this.graphNodes.set([]);
    this.graphEdges.set([]);
    this.fetchedResources.set(new Map());
    this.selectedNodeId.set(null);
    this.selectedResource.set(null);
    this.error.set(null);
  }

  /**
   * Fit graph to view
   */
  fitToView(): void {
    this.visNetwork?.fit();
  }

  /**
   * Focus on selected node
   */
  focusOnSelected(): void {
    const nodeId = this.selectedNodeId();

    if (nodeId) {
      this.visNetwork?.focusOnNode(nodeId);
    }
  }

  /**
   * Toggle physics simulation
   */
  togglePhysics(enabled: boolean): void {
    this.visNetwork?.setPhysics(enabled);
  }

  /**
   * Handle Monaco editor ready
   */
  onEditorReady(editor: any): void {
    this.detailEditor.set(editor);
    this.editorStateService.registerEditor(
      this.monacoEditor!,
      false,
      '/app/reference-graph'
    );
  }

  /**
   * Navigate to resource in Query tab
   */
  openInQuery(): void {
    const nodeId = this.selectedNodeId();

    if (nodeId) {
      // Store the query and navigate
      localStorage.setItem('fhir-text-query', `/${nodeId}`);
      localStorage.setItem('fhir-query-mode', 'text');
      window.location.hash = '#/app/query';
    }
  }

  /**
   * Expand all unexpanded nodes (one level)
   */
  async expandAll(): Promise<void> {
    const unexpandedNodes = this.graphNodes().filter(n => !n.expanded && !n.error);

    if (unexpandedNodes.length === 0) {
      this.toastService.info('All nodes are already expanded', 'Info');

      return;
    }

    if (unexpandedNodes.length > 10) {
      this.toastService.warning(
        `Expanding ${unexpandedNodes.length} nodes may take a while...`,
        'Warning'
      );
    }

    this.loading.set(true);

    try {
      let currentNodes = this.graphNodes();
      let currentEdges = this.graphEdges();
      let currentCache = this.fetchedResources();

      for (const node of unexpandedNodes) {
        const result = await firstValueFrom(
          this.graphService.expandNode(node.id, currentNodes, currentEdges, currentCache, 1)
        );
        currentNodes = result.nodes;
        currentEdges = result.edges;
        currentCache = result.fetchedResources;
      }

      this.graphNodes.set(currentNodes);
      this.graphEdges.set(currentEdges);
      this.fetchedResources.set(currentCache);

      this.logger.info(`Expanded all: now ${currentNodes.length} nodes`);
    } catch (err: any) {
      this.logger.error('Failed to expand all:', err);
      this.toastService.error('Failed to expand all nodes', 'Error');
    } finally {
      this.loading.set(false);
    }
  }
}
