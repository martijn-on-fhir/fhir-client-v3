/**
 * Reference Graph Models
 *
 * Data structures for the interactive FHIR resource reference graph visualization.
 */

/**
 * Represents a node in the reference graph
 */
export interface GraphNode {
  /** Unique identifier in format "ResourceType/id" */
  id: string;
  /** FHIR resource type (e.g., "Patient", "Observation") */
  resourceType: string;
  /** Resource ID */
  resourceId: string;
  /** Human-readable display label */
  label: string;
  /** Distance from root node (0 = root) */
  depth: number;
  /** Whether this node's references have been fetched */
  expanded: boolean;
  /** Full FHIR resource (cached after fetch) */
  resource?: any;
  /** Node background color (based on resource type) */
  color?: string;
  /** Node border color */
  borderColor?: string;
  /** Font color for label */
  fontColor?: string;
  /** Whether fetch failed for this resource */
  error?: boolean;
  /** Error message if fetch failed */
  errorMessage?: string;
}

/**
 * Represents an edge (connection) between two nodes
 */
export interface GraphEdge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID (ResourceType/id) */
  from: string;
  /** Target node ID (ResourceType/id) */
  to: string;
  /** Property name that contains the reference (e.g., "subject", "performer") */
  label: string;
  /** Full property path (e.g., "Observation.subject") */
  propertyPath?: string;
}

/**
 * Information about a reference extracted from a FHIR resource
 */
export interface ReferenceInfo {
  /** Reference string in format "ResourceType/id" */
  reference: string;
  /** Property name containing the reference */
  propertyName: string;
  /** Full property path from root */
  propertyPath: string;
  /** Display text from the reference (if available) */
  display?: string;
}

/**
 * Result of building a graph
 */
export interface GraphBuildResult {
  /** All nodes in the graph */
  nodes: GraphNode[];
  /** All edges in the graph */
  edges: GraphEdge[];
  /** Resources that were fetched (for caching) */
  fetchedResources: Map<string, any>;
}

/**
 * Resource type color configuration
 */
export interface ResourceTypeColor {
  /** Background color */
  background: string;
  /** Border color */
  border: string;
  /** Font color */
  font: string;
}

/**
 * Default colors for common FHIR resource types
 */
export const RESOURCE_TYPE_COLORS: Record<string, ResourceTypeColor> = {
  Patient: { background: '#4CAF50', border: '#388E3C', font: '#FFFFFF' },
  Practitioner: { background: '#2196F3', border: '#1976D2', font: '#FFFFFF' },
  PractitionerRole: { background: '#03A9F4', border: '#0288D1', font: '#FFFFFF' },
  Organization: { background: '#FF9800', border: '#F57C00', font: '#000000' },
  Observation: { background: '#9C27B0', border: '#7B1FA2', font: '#FFFFFF' },
  Condition: { background: '#F44336', border: '#D32F2F', font: '#FFFFFF' },
  Encounter: { background: '#00BCD4', border: '#0097A7', font: '#000000' },
  MedicationRequest: { background: '#E91E63', border: '#C2185B', font: '#FFFFFF' },
  Medication: { background: '#FF4081', border: '#F50057', font: '#FFFFFF' },
  Procedure: { background: '#795548', border: '#5D4037', font: '#FFFFFF' },
  DiagnosticReport: { background: '#673AB7', border: '#512DA8', font: '#FFFFFF' },
  Specimen: { background: '#8BC34A', border: '#689F38', font: '#000000' },
  Device: { background: '#607D8B', border: '#455A64', font: '#FFFFFF' },
  Location: { background: '#009688', border: '#00796B', font: '#FFFFFF' },
  CarePlan: { background: '#CDDC39', border: '#AFB42B', font: '#000000' },
  CareTeam: { background: '#FFC107', border: '#FFA000', font: '#000000' },
  Goal: { background: '#FFEB3B', border: '#FBC02D', font: '#000000' },
  AllergyIntolerance: { background: '#FF5722', border: '#E64A19', font: '#FFFFFF' },
  Immunization: { background: '#3F51B5', border: '#303F9F', font: '#FFFFFF' },
  DocumentReference: { background: '#9E9E9E', border: '#757575', font: '#FFFFFF' },
  Consent: { background: '#78909C', border: '#546E7A', font: '#FFFFFF' },
  RelatedPerson: { background: '#26A69A', border: '#00897B', font: '#FFFFFF' },
  // Default for unknown types
  default: { background: '#BDBDBD', border: '#9E9E9E', font: '#000000' }
};

/**
 * vis-network node format (for conversion)
 */
export interface VisNode {
  id: string;
  label: string;
  title?: string;
  color?: {
    background: string;
    border: string;
    highlight?: {
      background: string;
      border: string;
    };
  };
  font?: {
    color: string;
  };
  shape?: string;
  size?: number;
  borderWidth?: number;
  borderWidthSelected?: number;
}

/**
 * vis-network edge format (for conversion)
 */
export interface VisEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  arrows?: string;
  color?: {
    color: string;
    highlight: string;
  };
  font?: {
    size: number;
    color: string;
    strokeWidth: number;
    strokeColor: string;
  };
}
