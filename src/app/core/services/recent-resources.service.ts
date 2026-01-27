/**
 * Recent Resources Service - Manages recently viewed/executed FHIR queries
 *
 * Handles tracking, loading, and managing recent resources
 * with localStorage persistence and multi-server support
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { RecentResource } from '../models/recent-resource.model';
import { LoggerService } from './logger.service';
import { ServerProfileService } from './server-profile.service';

const RECENT_STORAGE_KEY = 'fhir_recent_resources';
const MAX_RECENT_ITEMS = 20;

@Injectable({
  providedIn: 'root'
})
export class RecentResourcesService {
  private serverProfileService = inject(ServerProfileService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('RecentResourcesService');

  // State signal
  private _recentResources = signal<RecentResource[]>([]);

  // Public readonly signal
  readonly recentResources = this._recentResources.asReadonly();

  // Computed: recent resources filtered by active server profile
  readonly currentProfileRecent = computed(() => {
    const activeProfileId = this.serverProfileService.activeProfileId();
    if (!activeProfileId) {
      return [];
    }
    return this._recentResources()
      .filter(r => r.serverProfileId === activeProfileId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_RECENT_ITEMS);
  });

  constructor() {
    this.loadRecentResources();
  }

  /**
   * Add a recent resource entry
   */
  addRecentResource(
    query: string,
    displayName: string,
    resultType: 'single' | 'bundle',
    resourceType: string
  ): void {
    const activeProfile = this.serverProfileService.activeProfile();
    if (!activeProfile) {
      this.logger.warn('Cannot add recent: no active profile');
      return;
    }

    // Remove existing entry for the same query (to move it to top)
    const filtered = this._recentResources().filter(
      r => !(r.query === query && r.serverProfileId === activeProfile.id)
    );

    const recent: RecentResource = {
      id: crypto.randomUUID(),
      query,
      displayName,
      resourceType,
      serverProfileId: activeProfile.id,
      timestamp: Date.now(),
      resultType
    };

    // Add to beginning and limit total items
    const updated = [recent, ...filtered].slice(0, MAX_RECENT_ITEMS * 5); // Keep more across all profiles
    this._recentResources.set(updated);
    this.persistRecentResources();
    this.logger.debug('Recent resource added:', { query });
  }

  /**
   * Clear recent resources for the current profile
   */
  clearRecent(): void {
    const activeProfileId = this.serverProfileService.activeProfileId();
    if (!activeProfileId) {
      return;
    }

    this._recentResources.update(resources =>
      resources.filter(r => r.serverProfileId !== activeProfileId)
    );
    this.persistRecentResources();
    this.logger.info('Recent resources cleared for profile:', activeProfileId);
  }

  /**
   * Load recent resources from localStorage
   */
  private loadRecentResources(): void {
    try {
      const stored = localStorage.getItem(RECENT_STORAGE_KEY);
      if (stored) {
        const resources = JSON.parse(stored) as RecentResource[];
        this._recentResources.set(resources);
        this.logger.debug('Recent resources loaded:', { count: resources.length });
      }
    } catch (error) {
      this.logger.error('Failed to load recent resources:', error);
      this._recentResources.set([]);
    }
  }

  /**
   * Persist recent resources to localStorage
   */
  private persistRecentResources(): void {
    try {
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(this._recentResources()));
    } catch (error) {
      this.logger.error('Failed to persist recent resources:', error);
    }
  }
}
