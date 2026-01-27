/**
 * Favorites Service - Manages favorite/bookmarked FHIR queries
 *
 * Handles loading, saving, and managing favorite resources
 * with localStorage persistence and multi-server support
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { FavoriteResource } from '../models/favorite-resource.model';
import { ServerProfileService } from './server-profile.service';
import { LoggerService } from './logger.service';

const FAVORITES_STORAGE_KEY = 'fhir_favorite_resources';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private serverProfileService = inject(ServerProfileService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('FavoritesService');

  // State signal
  private _favorites = signal<FavoriteResource[]>([]);

  // Public readonly signal
  readonly favorites = this._favorites.asReadonly();

  // Computed: favorites filtered by active server profile
  readonly currentProfileFavorites = computed(() => {
    const activeProfileId = this.serverProfileService.activeProfileId();
    if (!activeProfileId) {
      return [];
    }
    return this._favorites().filter(f => f.serverProfileId === activeProfileId);
  });

  constructor() {
    this.loadFavorites();
  }

  /**
   * Add a favorite
   */
  addFavorite(
    query: string,
    displayName: string,
    resultType: 'single' | 'bundle',
    resourceType: string
  ): FavoriteResource | null {
    const activeProfile = this.serverProfileService.activeProfile();
    if (!activeProfile) {
      this.logger.warn('Cannot add favorite: no active profile');
      return null;
    }

    const favorite: FavoriteResource = {
      id: crypto.randomUUID(),
      query,
      displayName,
      resourceType,
      serverProfileId: activeProfile.id,
      serverUrl: activeProfile.fhirServerUrl,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      resultType
    };

    this._favorites.update(favorites => [...favorites, favorite]);
    this.persistFavorites();
    this.logger.info('Favorite added:', { id: favorite.id, query });

    return favorite;
  }

  /**
   * Remove a favorite by ID
   */
  removeFavorite(id: string): boolean {
    const favorite = this._favorites().find(f => f.id === id);
    if (!favorite) {
      return false;
    }

    this._favorites.update(favorites => favorites.filter(f => f.id !== id));
    this.persistFavorites();
    this.logger.info('Favorite removed:', { id });

    return true;
  }

  /**
   * Toggle favorite status for a query
   * Returns true if favorite was added, false if removed
   */
  toggleFavorite(
    query: string,
    displayName: string,
    resultType: 'single' | 'bundle',
    resourceType: string
  ): boolean {
    const existing = this.getFavoriteByQuery(query);
    if (existing) {
      this.removeFavorite(existing.id);
      return false;
    } else {
      this.addFavorite(query, displayName, resultType, resourceType);
      return true;
    }
  }

  /**
   * Check if a query is favorited for the current profile
   */
  isFavorite(query: string): boolean {
    return this.getFavoriteByQuery(query) !== undefined;
  }

  /**
   * Get favorite by query string for the current profile
   */
  getFavoriteByQuery(query: string): FavoriteResource | undefined {
    const activeProfileId = this.serverProfileService.activeProfileId();
    if (!activeProfileId) {
      return undefined;
    }
    return this._favorites().find(
      f => f.query === query && f.serverProfileId === activeProfileId
    );
  }

  /**
   * Update last accessed timestamp for a favorite
   */
  updateLastAccessed(id: string): void {
    this._favorites.update(favorites =>
      favorites.map(f =>
        f.id === id ? { ...f, lastAccessedAt: Date.now() } : f
      )
    );
    this.persistFavorites();
  }

  /**
   * Load favorites from localStorage
   */
  private loadFavorites(): void {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const favorites = JSON.parse(stored) as FavoriteResource[];
        this._favorites.set(favorites);
        this.logger.debug('Favorites loaded:', { count: favorites.length });
      }
    } catch (error) {
      this.logger.error('Failed to load favorites:', error);
      this._favorites.set([]);
    }
  }

  /**
   * Persist favorites to localStorage
   */
  private persistFavorites(): void {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(this._favorites()));
    } catch (error) {
      this.logger.error('Failed to persist favorites:', error);
    }
  }
}
