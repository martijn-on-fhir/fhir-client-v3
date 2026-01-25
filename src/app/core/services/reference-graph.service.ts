import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  GraphNode,
  GraphEdge,
  ReferenceInfo,
  GraphBuildResult,
  RESOURCE_TYPE_COLORS,
  ResourceTypeColor,
  VisNode,
  VisEdge
} from '../models/reference-graph.model';
import { FhirService } from './fhir.service';
import { LoggerService } from './logger.service';

/**
 * Service for building and managing FHIR resource reference graphs
 *
 * Provides functionality to:
 * - Parse and validate FHIR references
 * - Extract references from resources recursively
 * - Fetch referenced resources with cycle detection
 * - Build graph data structures for visualization
 */
@Injectable({
  providedIn: 'root'
})
export class ReferenceGraphService {
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('ReferenceGraphService');

  /** Regex for relative references (ResourceType/id) */
  private readonly relativeRefPattern = /^([A-Z][a-zA-Z]+)\/([A-Za-z0-9\-.]+)$/;

  /** Regex for absolute URL references */
  private readonly absoluteUrlPattern = /^https?:\/\/.+\/([A-Z][a-zA-Z]+)\/([A-Za-z0-9\-.]+)$/;

  /**
   * Parse a FHIR reference string to extract resource type and ID
   * @param reference Reference string (relative, absolute, or URN)
   * @returns Parsed reference or null if invalid/unsupported
   */
  parseReference(reference: string): { resourceType: string; id: string } | null {
    if (!reference || typeof reference !== 'string') {
      return null;
    }

    // Skip contained references (#id) and URNs (urn:...)
    if (reference.startsWith('#') || reference.startsWith('urn:')) {
      return null;
    }

    // Try relative reference first (ResourceType/id)
    const relativeMatch = reference.match(this.relativeRefPattern);
    if (relativeMatch) {
      return { resourceType: relativeMatch[1], id: relativeMatch[2] };
    }

    // Try absolute URL
    const absoluteMatch = reference.match(this.absoluteUrlPattern);
    if (absoluteMatch) {
      return { resourceType: absoluteMatch[1], id: absoluteMatch[2] };
    }

    return null;
  }

  /**
   * Extract all references from a FHIR resource recursively
   * @param resource FHIR resource to extract references from
   * @param basePath Base path for property tracking (internal use)
   * @returns Array of reference information
   */
  extractReferences(resource: any, basePath: string = ''): ReferenceInfo[] {
    const results: ReferenceInfo[] = [];

    if (!resource || typeof resource !== 'object') {
      return results;
    }

    this.traverseForReferences(resource, basePath, results);
    return results;
  }

  /**
   * Recursive traversal to find references
   */
  private traverseForReferences(obj: any, path: string, results: ReferenceInfo[]): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // Check if this object has a reference property (FHIR Reference type)
    if (obj.reference && typeof obj.reference === 'string') {
      const parsed = this.parseReference(obj.reference);
      if (parsed) {
        const propertyName = this.getPropertyNameFromPath(path);
        results.push({
          reference: `${parsed.resourceType}/${parsed.id}`,
          propertyName: propertyName,
          propertyPath: path,
          display: obj.display
        });
      }
    }

    // Recursively check nested objects and arrays
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.traverseForReferences(item, `${path}[${index}]`, results);
      });
    } else {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && key !== 'reference') {
          const newPath = path ? `${path}.${key}` : key;
          this.traverseForReferences(obj[key], newPath, results);
        }
      }
    }
  }

  /**
   * Extract property name from a path string
   */
  private getPropertyNameFromPath(path: string): string {
    if (!path) {
return 'reference';
}

    // Remove array indices and get last segment
    const segments = path.replace(/\[\d+\]/g, '').split('.');
    return segments[segments.length - 1] || 'reference';
  }

  /**
   * Fetch a single FHIR resource by reference
   * @param reference Reference string (ResourceType/id)
   * @returns Observable of the resource or null on error
   */
  fetchResource(reference: string): Observable<any> {
    const parsed = this.parseReference(reference);
    if (!parsed) {
      this.logger.warn(`Invalid reference format: ${reference}`);
      return of(null);
    }

    return this.fhirService.read(parsed.resourceType, parsed.id).pipe(
      catchError(error => {
        this.logger.warn(`Failed to fetch ${reference}:`, error?.message || error);
        return of(null);
      })
    );
  }

  /**
   * Build a complete reference graph starting from a root resource
   * @param rootReference Root resource reference (e.g., "Patient/123")
   * @param maxDepth Maximum depth to traverse (default: 3)
   * @param existingCache Optional existing cache of fetched resources
   * @returns Observable of graph build result
   */
  buildGraph(
    rootReference: string,
    maxDepth: number = 3,
    existingCache?: Map<string, any>
  ): Observable<GraphBuildResult> {
    const fetchedResources = existingCache || new Map<string, any>();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const pendingRefs = new Set<string>();

    return this.fetchResource(rootReference).pipe(
      switchMap(rootResource => {
        if (!rootResource) {
          return of({ nodes: [], edges: [], fetchedResources });
        }

        // Add root node
        const rootNode = this.createNode(rootReference, rootResource, 0);
        rootNode.expanded = true;
        nodes.push(rootNode);
        fetchedResources.set(rootReference, rootResource);

        // Build graph recursively
        return this.expandGraphRecursive(
          rootResource,
          rootReference,
          0,
          maxDepth,
          nodes,
          edges,
          fetchedResources,
          pendingRefs
        ).pipe(
          map(() => ({ nodes, edges, fetchedResources }))
        );
      }),
      catchError(error => {
        this.logger.error('Failed to build graph:', error);
        return of({ nodes: [], edges: [], fetchedResources });
      })
    );
  }

  /**
   * Recursively expand the graph by fetching referenced resources
   */
  private expandGraphRecursive(
    resource: any,
    resourceRef: string,
    currentDepth: number,
    maxDepth: number,
    nodes: GraphNode[],
    edges: GraphEdge[],
    fetchedResources: Map<string, any>,
    pendingRefs: Set<string>
  ): Observable<void> {
    if (currentDepth >= maxDepth) {
      return of(undefined);
    }

    const references = this.extractReferences(resource, resource.resourceType || '');
    const newRefs = references.filter(ref =>
      !fetchedResources.has(ref.reference) && !pendingRefs.has(ref.reference)
    );

    if (newRefs.length === 0) {
      return of(undefined);
    }

    // Mark refs as pending
    newRefs.forEach(ref => pendingRefs.add(ref.reference));

    // Fetch all new references in parallel (with limit)
    const fetchObservables = newRefs.map(refInfo =>
      this.fetchResource(refInfo.reference).pipe(
        map(fetchedResource => ({ refInfo, fetchedResource }))
      )
    );

    return forkJoin(fetchObservables).pipe(
      switchMap(results => {
        const childExpansions: Observable<void>[] = [];

        results.forEach(({ refInfo, fetchedResource }) => {
          pendingRefs.delete(refInfo.reference);

          // Add edge regardless of fetch success
          const edge: GraphEdge = {
            id: `${resourceRef}->${refInfo.reference}`,
            from: resourceRef,
            to: refInfo.reference,
            label: refInfo.propertyName,
            propertyPath: refInfo.propertyPath
          };
          edges.push(edge);

          if (fetchedResource) {
            // Add node if not already present
            if (!nodes.find(n => n.id === refInfo.reference)) {
              const node = this.createNode(refInfo.reference, fetchedResource, currentDepth + 1);
              node.expanded = currentDepth + 1 < maxDepth;
              nodes.push(node);
            }

            fetchedResources.set(refInfo.reference, fetchedResource);

            // Recursively expand if not at max depth
            if (currentDepth + 1 < maxDepth) {
              childExpansions.push(
                this.expandGraphRecursive(
                  fetchedResource,
                  refInfo.reference,
                  currentDepth + 1,
                  maxDepth,
                  nodes,
                  edges,
                  fetchedResources,
                  pendingRefs
                )
              );
            }
          } else {
            // Add error node for failed fetch
            if (!nodes.find(n => n.id === refInfo.reference)) {
              const parsed = this.parseReference(refInfo.reference);
              const errorNode: GraphNode = {
                id: refInfo.reference,
                resourceType: parsed?.resourceType || 'Unknown',
                resourceId: parsed?.id || refInfo.reference,
                label: `${refInfo.reference} (not found)`,
                depth: currentDepth + 1,
                expanded: false,
                error: true,
                errorMessage: 'Resource not found or access denied',
                color: '#E0E0E0',
                borderColor: '#9E9E9E',
                fontColor: '#757575'
              };
              nodes.push(errorNode);
            }
          }
        });

        if (childExpansions.length === 0) {
          return of(undefined);
        }

        return forkJoin(childExpansions).pipe(map(() => undefined));
      })
    );
  }

  /**
   * Expand a single node (lazy loading)
   * @param nodeId Node ID to expand
   * @param currentNodes Current graph nodes
   * @param currentEdges Current graph edges
   * @param fetchedResources Cache of fetched resources
   * @param maxDepth Maximum additional depth to fetch
   * @returns Observable of updated graph
   */
  expandNode(
    nodeId: string,
    currentNodes: GraphNode[],
    currentEdges: GraphEdge[],
    fetchedResources: Map<string, any>,
    maxDepth: number = 1
  ): Observable<GraphBuildResult> {
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node || node.expanded || node.error) {
      return of({ nodes: currentNodes, edges: currentEdges, fetchedResources });
    }

    const resource = fetchedResources.get(nodeId);
    if (!resource) {
      return of({ nodes: currentNodes, edges: currentEdges, fetchedResources });
    }

    const nodes = [...currentNodes];
    const edges = [...currentEdges];
    const pendingRefs = new Set<string>();

    // Mark as expanded
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0) {
      nodes[nodeIndex] = { ...nodes[nodeIndex], expanded: true };
    }

    return this.expandGraphRecursive(
      resource,
      nodeId,
      node.depth,
      node.depth + maxDepth,
      nodes,
      edges,
      fetchedResources,
      pendingRefs
    ).pipe(
      map(() => ({ nodes, edges, fetchedResources }))
    );
  }

  /**
   * Create a graph node from a FHIR resource
   */
  private createNode(reference: string, resource: any, depth: number): GraphNode {
    const parsed = this.parseReference(reference);
    const resourceType = parsed?.resourceType || resource?.resourceType || 'Unknown';
    const colors = this.getResourceColor(resourceType);

    return {
      id: reference,
      resourceType: resourceType,
      resourceId: parsed?.id || resource?.id || reference,
      label: this.getDisplayLabel(resource),
      depth: depth,
      expanded: false,
      resource: resource,
      color: colors.background,
      borderColor: colors.border,
      fontColor: colors.font
    };
  }

  /**
   * Get color configuration for a resource type
   */
  getResourceColor(resourceType: string): ResourceTypeColor {
    return RESOURCE_TYPE_COLORS[resourceType] || RESOURCE_TYPE_COLORS['default'];
  }

  /**
   * Get a human-readable display label for a resource
   */
  getDisplayLabel(resource: any): string {
    if (!resource) {
return 'Unknown';
}

    const resourceType = resource.resourceType || 'Resource';

    // Try common display patterns
    // Patient/Practitioner/RelatedPerson
    if (resource.name) {
      const name = Array.isArray(resource.name) ? resource.name[0] : resource.name;
      if (name) {
        const given = Array.isArray(name.given) ? name.given.join(' ') : (name.given || '');
        const family = name.family || '';
        const text = name.text;
        if (text) {
return `${resourceType}: ${text}`;
}
        if (given || family) {
return `${resourceType}: ${given} ${family}`.trim();
}
      }
    }

    // Organization/Location
    if (resource.name && typeof resource.name === 'string') {
      return `${resourceType}: ${resource.name}`;
    }

    // Observation/DiagnosticReport (code)
    if (resource.code?.text) {
      return `${resourceType}: ${resource.code.text}`;
    }
    if (resource.code?.coding?.[0]?.display) {
      return `${resourceType}: ${resource.code.coding[0].display}`;
    }

    // Condition
    if (resource.code?.coding?.[0]?.display) {
      return `${resourceType}: ${resource.code.coding[0].display}`;
    }

    // Medication
    if (resource.code?.text) {
      return `${resourceType}: ${resource.code.text}`;
    }

    // Encounter
    if (resource.class?.display || resource.class?.code) {
      return `${resourceType}: ${resource.class.display || resource.class.code}`;
    }

    // Device
    if (resource.deviceName?.[0]?.name) {
      return `${resourceType}: ${resource.deviceName[0].name}`;
    }

    // Generic fallback with ID
    return `${resourceType}/${resource.id || 'unknown'}`;
  }

  /**
   * Convert GraphNode array to vis-network format
   */
  toVisNodes(nodes: GraphNode[]): VisNode[] {
    return nodes.map(node => ({
      id: node.id,
      label: node.label,
      title: `${node.resourceType}/${node.resourceId}${node.error ? '\n(Error: ' + node.errorMessage + ')' : ''}`,
      color: {
        background: node.color || '#BDBDBD',
        border: node.borderColor || '#9E9E9E',
        highlight: {
          background: node.color || '#BDBDBD',
          border: '#000000'
        }
      },
      font: {
        color: node.fontColor || '#000000'
      },
      shape: 'box',
      borderWidth: node.error ? 2 : 1,
      borderWidthSelected: 3,
      shapeProperties: {
        borderDashes: node.error ? [5, 5] : false
      }
    } as VisNode));
  }

  /**
   * Convert GraphEdge array to vis-network format
   */
  toVisEdges(edges: GraphEdge[]): VisEdge[] {
    return edges.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      arrows: 'to',
      color: {
        color: '#848484',
        highlight: '#000000'
      },
      font: {
        size: 10,
        color: '#666666',
        strokeWidth: 2,
        strokeColor: '#FFFFFF'
      }
    }));
  }
}
