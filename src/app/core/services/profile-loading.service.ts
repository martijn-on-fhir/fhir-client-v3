import { Injectable, inject } from '@angular/core';
import { mergeProfileElements, extractConstraints, MergedElement, Constraint } from '../utils/profile-merge';
import { LoggerService } from './logger.service';
import { NictizService } from './nictiz.service';

/**
 * Result from loading a profile
 */
export interface ProfileLoadResult {
  /** Full StructureDefinition with merged snapshot elements */
  structureDefinition: any;
  /** Array of base definitions in inheritance chain */
  baseChain: any[];
  /** Merged elements from profile and base definitions */
  mergedElements: MergedElement[];
  /** Extracted constraints from profile */
  constraints: Constraint[];
}

/**
 * Cached profile data structure (matches Electron cache format)
 */
interface CachedProfileData {
  profile: {
    id?: string;
    url?: string;
    name?: string;
    type?: string;
    title?: string;
    description?: string;
    purpose?: string;
    baseDefinition?: string;
    version?: string;
  };
  baseChain: { name: string; url: string }[];
  mergedElements: MergedElement[];
  constraints: Constraint[];
}

/**
 * Profile Loading Service
 *
 * Provides unified profile loading logic with caching support.
 * Consolidates duplicated code from app.component, nictiz.component, and profiles.component.
 *
 * Features:
 * - Loads StructureDefinition profiles by URL
 * - Fetches and merges base definition chain
 * - Extracts constraints from profile hierarchy
 * - Caches results to Electron disk cache
 * - Provides cache management (get, invalidate)
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileLoadingService {
  private nictizService = inject(NictizService);
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('ProfileLoadingService');

  /**
   * Loads a profile from cache or server
   *
   * Loading strategy:
   * 1. Check Electron disk cache first
   * 2. If cached, return cached data
   * 3. Fetch StructureDefinition from server
   * 4. Fetch base definition chain (inheritance)
   * 5. Merge elements from profile and base definitions
   * 6. Extract constraints
   * 7. Cache result for future use
   *
   * @param profileUrl - Canonical URL of the StructureDefinition
   * @param profileTitle - Title/name for cache key
   * @returns Promise resolving to ProfileLoadResult or null if not found
   */
  async loadProfile(profileUrl: string, profileTitle: string): Promise<ProfileLoadResult | null> {
    // 1. Check cache first
    const cached = await this.getCachedProfile(profileTitle);

    if (cached) {
      return cached;
    }

    // 2. Fetch StructureDefinition from server
    const sd = await this.nictizService.fetchSingleStructureDefinition(profileUrl);

    if (!sd) {
      return null;
    }

    // 3. Fetch base definition chain
    let baseChain: any[] = [];

    if (sd.baseDefinition) {
      baseChain = await this.nictizService.fetchBaseDefinitionChain(sd.baseDefinition);
    }

    // 4. Merge elements and extract constraints
    const mergedElements = mergeProfileElements(sd, baseChain);
    const constraints = extractConstraints(sd, baseChain);

    // 5. Build full SD with merged elements
    const fullSD = {
      ...sd,
      snapshot: {
        element: mergedElements
      }
    };

    // 6. Cache for future use
    await this.cacheProfile(profileTitle, sd, baseChain, mergedElements, constraints);

    return {
      structureDefinition: fullSD,
      baseChain,
      mergedElements,
      constraints
    };
  }

  /**
   * Gets a cached profile by title
   *
   * @param profileTitle - Cache key (profile title or resource type)
   * @returns Promise resolving to ProfileLoadResult or null if not cached
   */
  async getCachedProfile(profileTitle: string): Promise<ProfileLoadResult | null> {
    try {
      const cached: CachedProfileData | null = await window.electronAPI?.profileCache?.getProfile(profileTitle);

      if (cached) {
        const fullSD = {
          ...cached.profile,
          snapshot: {
            element: cached.mergedElements || []
          }
        };

        return {
          structureDefinition: fullSD,
          baseChain: cached.baseChain || [],
          mergedElements: cached.mergedElements || [],
          constraints: cached.constraints || []
        };
      }
    } catch (error) {
      this.logger.error('Failed to get cached profile:', error);
    }

    return null;
  }

  /**
   * Invalidates cached profiles
   *
   * @param profileTitle - Optional specific profile to invalidate. If not provided, clears all.
   */
  async invalidateCache(profileTitle?: string): Promise<void> {
    try {
      if (profileTitle) {
        // Invalidate specific profile by setting to null
        await window.electronAPI?.profileCache?.setProfile(profileTitle, null);
      } else {
        // Clear entire cache
        await window.electronAPI?.profileCache?.clear();
      }
    } catch (error) {
      this.logger.error('Failed to invalidate cache:', error);
      throw error;
    }
  }

  /**
   * Caches a profile to disk
   *
   * @param profileTitle - Cache key
   * @param sd - Original StructureDefinition
   * @param baseChain - Base definition chain
   * @param mergedElements - Merged elements
   * @param constraints - Extracted constraints
   */
  private async cacheProfile(
    profileTitle: string,
    sd: any,
    baseChain: any[],
    mergedElements: MergedElement[],
    constraints: Constraint[]
  ): Promise<void> {
    try {
      await window.electronAPI?.profileCache?.setProfile(profileTitle, {
        profile: {
          id: sd.id,
          url: sd.url,
          name: sd.name,
          type: sd.type,
          title: sd.title || sd.name,
          description: sd.description,
          purpose: sd.purpose,
          baseDefinition: sd.baseDefinition,
          version: sd.version,
        },
        baseChain: baseChain.map((bd) => ({
          name: bd.name,
          url: bd.url,
        })),
        mergedElements,
        constraints,
      });
    } catch (error) {
      // Caching failure is not critical, just log
      this.logger.error('Failed to cache profile:', error);
    }
  }
}
