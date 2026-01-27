/**
 * Query Analytics Service
 *
 * Calculates performance analytics from query history
 */

import { Injectable, inject } from '@angular/core';
import {
  QueryAnalytics,
  QueryAnalyticsSummary,
  ResourceTypePerformance,
  SlowQuery,
  OptimizationSuggestion,
  DEFAULT_SLOW_THRESHOLD
} from '../models/query-analytics.model';
import { QueryHistoryService, QueryHistoryEntry } from './query-history.service';

@Injectable({
  providedIn: 'root'
})
export class QueryAnalyticsService {
  private queryHistoryService = inject(QueryHistoryService);

  /**
   * Calculate complete analytics from query history
   */
  getAnalytics(slowThreshold: number = DEFAULT_SLOW_THRESHOLD): QueryAnalytics {
    const history = this.queryHistoryService.getHistory();
    const entriesWithMetrics = history.filter(e => e.metrics?.executionTime != null);

    if (entriesWithMetrics.length === 0) {
      return this.getEmptyAnalytics(slowThreshold);
    }

    return {
      summary: this.calculateSummary(entriesWithMetrics),
      byResourceType: this.calculateByResourceType(entriesWithMetrics, slowThreshold),
      slowQueries: this.findSlowQueries(entriesWithMetrics, slowThreshold),
      suggestions: this.generateSuggestions(history),
      slowThreshold
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(entries: QueryHistoryEntry[]): QueryAnalyticsSummary {
    const times = entries.map(e => e.metrics!.executionTime);
    const sizes = entries.map(e => e.metrics?.responseSize || 0);

    const sortedTimes = [...times].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);

    return {
      totalQueries: entries.length,
      averageTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      slowestTime: Math.max(...times),
      fastestTime: Math.min(...times),
      p95Time: sortedTimes[p95Index] || sortedTimes[sortedTimes.length - 1],
      averageSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
      totalSize: sizes.reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Calculate performance breakdown by resource type
   */
  private calculateByResourceType(
    entries: QueryHistoryEntry[],
    slowThreshold: number
  ): ResourceTypePerformance[] {
    const byType = new Map<string, QueryHistoryEntry[]>();

    for (const entry of entries) {
      const resourceType = this.extractResourceType(entry.query);
      const existing = byType.get(resourceType) || [];
      existing.push(entry);
      byType.set(resourceType, existing);
    }

    const results: ResourceTypePerformance[] = [];

    for (const [resourceType, typeEntries] of byType) {
      const times = typeEntries.map(e => e.metrics!.executionTime);
      const sizes = typeEntries.map(e => e.metrics?.responseSize || 0);
      const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

      results.push({
        resourceType,
        queryCount: typeEntries.length,
        averageTime: avgTime,
        slowestTime: Math.max(...times),
        averageSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
        status: this.getPerformanceStatus(avgTime, slowThreshold)
      });
    }

    // Sort by query count descending
    return results.sort((a, b) => b.queryCount - a.queryCount);
  }

  /**
   * Find slow queries above threshold
   */
  private findSlowQueries(
    entries: QueryHistoryEntry[],
    slowThreshold: number
  ): SlowQuery[] {
    return entries
      .filter(e => e.metrics!.executionTime >= slowThreshold)
      .sort((a, b) => b.metrics!.executionTime - a.metrics!.executionTime)
      .slice(0, 10) // Top 10 slowest
      .map(e => ({
        query: e.query,
        executionTime: e.metrics!.executionTime,
        responseSize: e.metrics?.responseSize || 0,
        timestamp: e.timestamp,
        resourceType: this.extractResourceType(e.query),
        suggestions: this.getQuerySuggestions(e.query)
      }));
  }

  /**
   * Generate optimization suggestions based on query patterns
   */
  private generateSuggestions(entries: QueryHistoryEntry[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for _include without _count
    const includeWithoutCount = entries.filter(e =>
      e.query.includes('_include') && !e.query.includes('_count')
    );
    if (includeWithoutCount.length > 0) {
      suggestions.push({
        type: 'include',
        message: 'Queries with _include but no _count limit may return large result sets',
        affectedQueries: includeWithoutCount.length
      });
    }

    // Check for queries without _count
    const withoutCount = entries.filter(e =>
      !e.query.includes('_count') && !e.query.includes('/$')
    );
    if (withoutCount.length > 3) {
      suggestions.push({
        type: 'count',
        message: 'Consider adding _count parameter to limit result size',
        affectedQueries: withoutCount.length
      });
    }

    // Check for potential _summary usage
    const largeResponses = entries.filter(e =>
      (e.metrics?.responseSize || 0) > 100000 && !e.query.includes('_summary')
    );
    if (largeResponses.length > 0) {
      suggestions.push({
        type: 'summary',
        message: 'Use _summary=true for overview queries to reduce response size',
        affectedQueries: largeResponses.length
      });
    }

    // Check for queries that could use _elements
    const withoutElements = entries.filter(e =>
      !e.query.includes('_elements') &&
      !e.query.includes('_summary') &&
      (e.metrics?.responseSize || 0) > 50000
    );
    if (withoutElements.length > 0) {
      suggestions.push({
        type: 'elements',
        message: 'Use _elements parameter to request only needed fields',
        affectedQueries: withoutElements.length
      });
    }

    // Check for deep _include chains
    const deepIncludes = entries.filter(e => {
      const includeMatches = e.query.match(/_include/g);

      return includeMatches && includeMatches.length > 2;
    });
    if (deepIncludes.length > 0) {
      suggestions.push({
        type: 'include',
        message: 'Multiple _include parameters can significantly slow queries',
        affectedQueries: deepIncludes.length
      });
    }

    return suggestions;
  }

  /**
   * Get specific suggestions for a slow query
   */
  private getQuerySuggestions(query: string): string[] {
    const suggestions: string[] = [];

    if (query.includes('_include') && !query.includes('_count')) {
      suggestions.push('Add _count to limit results when using _include');
    }

    if (query.includes('_revinclude')) {
      suggestions.push('_revinclude can be slow; consider separate queries');
    }

    const includeMatches = query.match(/_include/g);
    if (includeMatches && includeMatches.length > 2) {
      suggestions.push('Reduce number of _include parameters');
    }

    if (!query.includes('_count') && !query.includes('/$')) {
      suggestions.push('Add _count parameter to limit result size');
    }

    if (query.includes(':iterate')) {
      suggestions.push(':iterate modifier can cause recursive fetching');
    }

    if (suggestions.length === 0) {
      suggestions.push('Check server-side indexing for search parameters used');
    }

    return suggestions;
  }

  /**
   * Extract resource type from query
   */
  private extractResourceType(query: string): string {
    const path = query.split('?')[0];
    const segments = path.split('/').filter(Boolean);

    return segments[0] || 'Unknown';
  }

  /**
   * Determine performance status based on average time
   */
  private getPerformanceStatus(avgTime: number, slowThreshold: number): 'fast' | 'normal' | 'slow' {
    if (avgTime < slowThreshold * 0.5) {
      return 'fast';
    }

    if (avgTime >= slowThreshold) {
      return 'slow';
    }

    return 'normal';
  }

  /**
   * Return empty analytics when no data
   */
  private getEmptyAnalytics(slowThreshold: number): QueryAnalytics {
    return {
      summary: {
        totalQueries: 0,
        averageTime: 0,
        slowestTime: 0,
        fastestTime: 0,
        p95Time: 0,
        averageSize: 0,
        totalSize: 0
      },
      byResourceType: [],
      slowQueries: [],
      suggestions: [],
      slowThreshold
    };
  }
}
