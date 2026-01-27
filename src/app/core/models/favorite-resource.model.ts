/**
 * Favorite Resource Model
 *
 * Represents a bookmarked FHIR query (search, single resource, or complex query)
 */
export interface FavoriteResource {
  /** Unique identifier */
  id: string;
  /** Full query path (e.g., '/Patient/123' or '/Patient?name=Smith') */
  query: string;
  /** User-friendly name (auto-generated or user-defined) */
  displayName: string;
  /** Primary resource type from query */
  resourceType: string;
  /** Server profile ID for multi-server support */
  serverProfileId: string;
  /** Base URL at time of bookmarking */
  serverUrl: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last accessed timestamp for "recently used" sorting */
  lastAccessedAt?: number;
  /** Type of result */
  resultType: 'single' | 'bundle';
}
