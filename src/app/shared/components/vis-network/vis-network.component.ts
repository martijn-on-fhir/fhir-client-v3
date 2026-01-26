import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  OnDestroy,
  inject
} from '@angular/core';
import { Network, DataSet, Options } from 'vis-network/standalone';
import { VisNode, VisEdge } from '../../../core/models/reference-graph.model';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * vis-network Wrapper Component
 *
 * Provides an Angular wrapper around the vis-network library for
 * creating interactive network graphs.
 *
 * @example
 * ```html
 * <app-vis-network
 *   [nodes]="graphNodes"
 *   [edges]="graphEdges"
 *   (nodeClick)="onNodeClick($event)"
 *   (nodeDoubleClick)="onNodeDoubleClick($event)">
 * </app-vis-network>
 * ```
 */
@Component({
  selector: 'app-vis-network',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vis-network-container">
      <div #networkContainer class="network-canvas"></div>
      @if (loading) {
        <div class="loading-overlay">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .vis-network-container {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }

    .network-canvas {
      width: 100%;
      height: 100%;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.7);
      z-index: 10;
    }
  `]
})
export class VisNetworkComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('networkContainer', { static: false }) containerRef!: ElementRef<HTMLDivElement>;

  /** Nodes to display in the network */
  @Input() nodes: VisNode[] = [];

  /** Edges connecting nodes */
  @Input() edges: VisEdge[] = [];

  /** vis-network options */
  @Input() options: Options = {};

  /** Show loading overlay */
  @Input() loading = false;

  /** Emitted when a node is clicked */
  @Output() nodeClick = new EventEmitter<string>();

  /** Emitted when a node is double-clicked */
  @Output() nodeDoubleClick = new EventEmitter<string>();

  /** Emitted when an edge is clicked */
  @Output() edgeClick = new EventEmitter<string>();

  /** Emitted when selection changes */
  @Output() selectionChange = new EventEmitter<{ nodes: string[]; edges: string[] }>();

  /** Emitted when the network is stabilized */
  @Output() stabilized = new EventEmitter<void>();

  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('VisNetworkComponent');

  private network: Network | null = null;
  private nodesDataSet: DataSet<VisNode> | null = null;
  private edgesDataSet: DataSet<VisEdge> | null = null;
  private isInitialized = false;

  /** Default network options */
  private defaultOptions: Options = {
    nodes: {
      shape: 'box',
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      font: {
        size: 12,
        face: 'Segoe UI, Arial, sans-serif'
      },
      shadow: {
        enabled: true,
        size: 5,
        x: 2,
        y: 2
      }
    },
    edges: {
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 0.5
        }
      },
      smooth: false,
      font: {
        size: 10,
        align: 'middle'
      }
    },
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -50,
        centralGravity: 0.01,
        springLength: 150,
        springConstant: 0.05,
        damping: 0.7,
        avoidOverlap: 0.5
      },
      stabilization: {
        enabled: true,
        iterations: 300,
        updateInterval: 25,
        fit: true
      },
      maxVelocity: 30,
      minVelocity: 0.75
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      zoomView: true,
      dragView: true,
      dragNodes: true,
      multiselect: false,
      navigationButtons: true,
      keyboard: {
        enabled: true
      }
    },
    layout: {
      improvedLayout: true,
      hierarchical: false
    }
  };

  ngAfterViewInit(): void {
    this.initNetwork();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isInitialized) {
      return;
    }

    if (changes['nodes'] || changes['edges']) {
      this.updateData();
    }

    if (changes['options']) {
      this.updateOptions();
    }
  }

  ngOnDestroy(): void {
    this.destroyNetwork();
  }

  /**
   * Initialize the vis-network instance
   */
  private initNetwork(): void {
    if (!this.containerRef?.nativeElement) {
      this.logger.warn('Container element not available');

      return;
    }

    try {
      // Create datasets
      this.nodesDataSet = new DataSet<VisNode>(this.nodes);
      this.edgesDataSet = new DataSet<VisEdge>(this.edges);

      // Merge options
      const mergedOptions = this.mergeOptions(this.defaultOptions, this.options);

      // Create network
      this.network = new Network(
        this.containerRef.nativeElement,
        {
          nodes: this.nodesDataSet,
          edges: this.edgesDataSet
        },
        mergedOptions
      );

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      this.logger.info('Network initialized');
    } catch (error) {
      this.logger.error('Failed to initialize network:', error);
    }
  }

  /**
   * Set up event listeners for the network
   */
  private setupEventListeners(): void {
    if (!this.network) {
return;
}

    // Single click
    this.network.on('click', (params) => {
      if (params.nodes.length > 0) {
        this.nodeClick.emit(params.nodes[0]);
      } else if (params.edges.length > 0) {
        this.edgeClick.emit(params.edges[0]);
      }
    });

    // Double click
    this.network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        this.nodeDoubleClick.emit(params.nodes[0]);
      }
    });

    // Selection change
    this.network.on('selectNode', (params) => {
      this.selectionChange.emit({
        nodes: params.nodes,
        edges: params.edges
      });
    });

    this.network.on('deselectNode', () => {
      this.selectionChange.emit({ nodes: [], edges: [] });
    });

    // Stabilization complete
    this.network.on('stabilizationIterationsDone', () => {
      this.stabilized.emit();
      // Disable physics after stabilization for better performance
      this.network?.setOptions({ physics: { enabled: false } });
    });

    // Fix node position after dragging to prevent jumping
    this.network.on('dragEnd', (params) => {
      if (params.nodes.length > 0) {
        // Disable physics after dragging to stabilize the graph
        this.network?.setOptions({ physics: { enabled: false } });
      }
    });
  }

  /**
   * Update the network data
   */
  private updateData(): void {
    if (!this.nodesDataSet || !this.edgesDataSet) {
      return;
    }

    // Update nodes
    const currentNodeIds = this.nodesDataSet.getIds();
    const newNodeIds = this.nodes.map(n => n.id);

    // Remove nodes that no longer exist
    const nodesToRemove = currentNodeIds.filter(id => !newNodeIds.includes(id as string));

    if (nodesToRemove.length > 0) {
      this.nodesDataSet.remove(nodesToRemove);
    }

    // Add or update nodes
    this.nodesDataSet.update(this.nodes);

    // Update edges
    const currentEdgeIds = this.edgesDataSet.getIds();
    const newEdgeIds = this.edges.map(e => e.id);

    // Remove edges that no longer exist
    const edgesToRemove = currentEdgeIds.filter(id => !newEdgeIds.includes(id as string));

    if (edgesToRemove.length > 0) {
      this.edgesDataSet.remove(edgesToRemove);
    }

    // Add or update edges
    this.edgesDataSet.update(this.edges);

    // Re-enable physics briefly for new layout
    if (this.network && (nodesToRemove.length > 0 || this.nodes.length > currentNodeIds.length)) {
      this.network.setOptions({ physics: { enabled: true } });
    }
  }

  /**
   * Update network options
   */
  private updateOptions(): void {
    if (!this.network) {
return;
}

    const mergedOptions = this.mergeOptions(this.defaultOptions, this.options);
    this.network.setOptions(mergedOptions);
  }

  /**
   * Deep merge options objects
   */
  private mergeOptions(defaults: Options, overrides: Options): Options {
    const result = { ...defaults };

    for (const key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        const defaultValue = (defaults as any)[key];
        const overrideValue = (overrides as any)[key];

        if (defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue) &&
            overrideValue && typeof overrideValue === 'object' && !Array.isArray(overrideValue)) {
          (result as any)[key] = this.mergeOptions(defaultValue, overrideValue);
        } else {
          (result as any)[key] = overrideValue;
        }
      }
    }

    return result;
  }

  /**
   * Destroy the network instance
   */
  private destroyNetwork(): void {
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.nodesDataSet = null;
    this.edgesDataSet = null;
    this.isInitialized = false;
  }

  // Public methods for external control

  /**
   * Fit the network to show all nodes
   */
  fit(): void {
    this.network?.fit({
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad'
      }
    });
  }

  /**
   * Focus on a specific node
   */
  focusOnNode(nodeId: string): void {
    this.network?.focus(nodeId, {
      scale: 1.2,
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad'
      }
    });
  }

  /**
   * Select a node programmatically
   */
  selectNode(nodeId: string): void {
    this.network?.selectNodes([nodeId]);
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.network?.unselectAll();
  }

  /**
   * Enable/disable physics
   */
  setPhysics(enabled: boolean): void {
    this.network?.setOptions({ physics: { enabled } });
  }

  /**
   * Get the network instance for advanced operations
   */
  getNetwork(): Network | null {
    return this.network;
  }
}
