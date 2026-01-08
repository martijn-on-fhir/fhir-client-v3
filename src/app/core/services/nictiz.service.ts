import { Injectable, signal } from '@angular/core';
import { FhirService } from './fhir.service';

export interface NictizProfile {
  url: string;
  title: string;
  name: string;
  type: string;
}

@Injectable({
  providedIn: 'root'
})
export class NictizService {
  structureDefinitions = signal<NictizProfile[]>([]);
  isLoading = signal<boolean>(false);
  isFetched = signal<boolean>(false);
  error = signal<string | null>(null);

  constructor(private fhirService: FhirService) {}

  /**
   * Fetch all Nictiz StructureDefinitions from server
   */
  async fetchStructureDefinitions(): Promise<void> {
    if (this.isLoading() || this.isFetched()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Fetch from server
      const query = '/administration/StructureDefinition?publisher=Nictiz&_summary=true&_count=1000';

      this.fhirService.executeQuery(query).subscribe({
        next: async (bundle: any) => {
          const profiles: NictizProfile[] = [];

          if (bundle.entry) {
            bundle.entry.forEach((entry: any) => {
              const resource = entry.resource;
              if (resource.resourceType === 'StructureDefinition') {
                profiles.push({
                  url: resource.url,
                  title: resource.title || resource.name,
                  name: resource.name,
                  type: resource.type
                });
              }
            });
          }

          this.structureDefinitions.set(profiles);
          this.isFetched.set(true);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to fetch Nictiz profiles');
          this.isLoading.set(false);
        }
      });
    } catch (err: any) {
      this.error.set(err.message || 'Failed to fetch Nictiz profiles');
      this.isLoading.set(false);
    }
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    try {
      await window.electronAPI?.profileCache?.clear();
      this.structureDefinitions.set([]);
      this.isFetched.set(false);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Fetch a single StructureDefinition by URL
   */
  async fetchSingleStructureDefinition(url: string): Promise<any | null> {
    try {
      const encodedUrl = encodeURIComponent(url);
      const query = `/administration/StructureDefinition?url=${encodedUrl}`;

      return new Promise((resolve, reject) => {
        this.fhirService.executeQuery(query).subscribe({
          next: (response: any) => {
            if (response.entry && response.entry.length > 0) {
              resolve(response.entry[0].resource);
            } else {
              resolve(null);
            }
          },
          error: (err) => {
            reject(err);
          }
        });
      });
    } catch (error) {
      console.error('Error fetching StructureDefinition:', error);
      return null;
    }
  }

  /**
   * Recursively fetch baseDefinition chain
   */
  async fetchBaseDefinitionChain(baseDefUrl: string): Promise<any[]> {
    const chain: any[] = [];
    let currentUrl = baseDefUrl;
    let depth = 0;
    const maxDepth = 10;

    while (currentUrl && depth < maxDepth) {
      const baseDef = await this.fetchSingleStructureDefinition(currentUrl);

      if (!baseDef) {
        break;
      }

      chain.push(baseDef);

      if (baseDef.baseDefinition && baseDef.baseDefinition !== currentUrl) {
        currentUrl = baseDef.baseDefinition;
        depth++;
      } else {
        break;
      }
    }

    return chain;
  }
}
