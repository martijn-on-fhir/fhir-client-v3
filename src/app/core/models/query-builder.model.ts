/**
 * Query Builder Models
 *
 * Type definitions for the FHIR visual query builder.
 */

/**
 * Query parameter structure
 */
export interface QueryParameter {
  name: string;
  type: string;
  operator?: string; // Prefix operator for date/number (gt, lt, eq, ge, le, ne)
  modifier?: string; // Search modifier for string/token (:exact, :contains, :text, :missing, :not)
  values: string[]; // Support multiple values for OR logic
  chain?: string; // Chained parameter for reference types (e.g., "name" for "patient.name")
}

/**
 * Search parameter metadata structure
 */
export interface SearchParameter {
  name: string;
  type: string;
  documentation?: string;
}

/**
 * Resource metadata structure from CapabilityStatement
 */
export interface ResourceMetadata {
  type: string;
  searchParam?: SearchParameter[];
  searchInclude?: string[];
  searchRevInclude?: string[];
}

/**
 * Query template structure for saving/loading queries
 */
export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  resource: string;
  parameters: QueryParameter[];
  includes: string[];
  revIncludes: string[];
  count: string;
  sort: string;
  summary: string;
  createdAt: string;
}

/**
 * Builder state for localStorage persistence
 */
export interface QueryBuilderState {
  selectedResource: string | null;
  parameters: QueryParameter[];
  selectedIncludes: string[];
  selectedRevIncludes: string[];
  count: string;
  sort: string;
  summary: string;
}
