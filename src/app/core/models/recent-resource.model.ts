/**
 * Recent Resource Model
 *
 * Represents a recently viewed/executed FHIR query
 */
export interface RecentResource {
  /** Unique identifier */
  id: string;
  /** Full query path (e.g., '/Patient/123' or '/Patient?name=Smith') */
  query: string;
  /** User-friendly name (auto-generated) */
  displayName: string;
  /** Primary resource type from query */
  resourceType: string;
  /** Server profile ID for multi-server support */
  serverProfileId: string;
  /** Timestamp when query was executed */
  timestamp: number;
  /** Type of result */
  resultType: 'single' | 'bundle';
}
