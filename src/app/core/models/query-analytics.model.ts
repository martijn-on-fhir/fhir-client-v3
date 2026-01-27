/**
 * Query Analytics Models
 *
 * Types for query performance analytics and optimization suggestions
 */

/**
 * Summary statistics for all queries
 */
export interface QueryAnalyticsSummary {
  /** Total number of queries in history */
  totalQueries: number;
  /** Average execution time in ms */
  averageTime: number;
  /** Slowest query time in ms */
  slowestTime: number;
  /** Fastest query time in ms */
  fastestTime: number;
  /** 95th percentile execution time */
  p95Time: number;
  /** Average response size in bytes */
  averageSize: number;
  /** Total response size in bytes */
  totalSize: number;
}

/**
 * Performance breakdown by resource type
 */
export interface ResourceTypePerformance {
  /** Resource type name */
  resourceType: string;
  /** Number of queries for this type */
  queryCount: number;
  /** Average execution time in ms */
  averageTime: number;
  /** Slowest query time for this type */
  slowestTime: number;
  /** Average response size in bytes */
  averageSize: number;
  /** Performance status */
  status: 'fast' | 'normal' | 'slow';
}

/**
 * A slow query entry
 */
export interface SlowQuery {
  /** The query string */
  query: string;
  /** Execution time in ms */
  executionTime: number;
  /** Response size in bytes */
  responseSize: number;
  /** Timestamp when query was executed */
  timestamp: number;
  /** Resource type */
  resourceType: string;
  /** Optimization suggestions for this query */
  suggestions: string[];
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Suggestion type/category */
  type: 'include' | 'count' | 'summary' | 'elements' | 'general';
  /** Human-readable suggestion */
  message: string;
  /** Number of queries this applies to */
  affectedQueries: number;
}

/**
 * Complete analytics result
 */
export interface QueryAnalytics {
  /** Summary statistics */
  summary: QueryAnalyticsSummary;
  /** Performance by resource type */
  byResourceType: ResourceTypePerformance[];
  /** Slow queries (above threshold) */
  slowQueries: SlowQuery[];
  /** Optimization suggestions */
  suggestions: OptimizationSuggestion[];
  /** Threshold used for slow query detection (ms) */
  slowThreshold: number;
}

/**
 * Default slow query threshold in milliseconds
 */
export const DEFAULT_SLOW_THRESHOLD = 500;
