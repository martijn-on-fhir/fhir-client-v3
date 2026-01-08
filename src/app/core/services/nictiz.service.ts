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
   * Fetches in batches of 50 until all profiles are retrieved
   */
  async fetchStructureDefinitions(): Promise<void> {
    if (this.isLoading() || this.isFetched()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const allProfiles: NictizProfile[] = [];
      const seenUrls = new Set<string>(); // Track URLs to detect duplicates
      let nextUrl: string | null = `/administration/StructureDefinition?publisher=Nictiz,HL7 Netherlands&status=active&kind=resource&_summary=data&_count=50`;
      let batchCount = 0;
      const maxBatches = 100; // Safety limit: max 5000 profiles

      // Keep fetching batches using FHIR pagination links
      while (nextUrl && batchCount < maxBatches) {
        batchCount++;

        // Convert Observable to Promise
        const bundle: any = await new Promise((resolve, reject) => {
          this.fhirService.executeQuery(nextUrl!).subscribe({
            next: (bundle) => resolve(bundle),
            error: (err) => reject(err)
          });
        });

        const totalEntries = bundle.entry?.length || 0;
        let newProfilesCount = 0;
        let structureDefCount = 0;

        // Process entries from this batch
        if (bundle.entry && bundle.entry.length > 0) {
          bundle.entry.forEach((entry: any) => {
            const resource = entry.resource;
            if (resource.resourceType === 'StructureDefinition') {
              structureDefCount++;

              // Only add if we haven't seen this URL before
              if (!seenUrls.has(resource.url)) {
                seenUrls.add(resource.url);
                newProfilesCount++;
                allProfiles.push({
                  url: resource.url,
                  title: resource.title || resource.name,
                  name: resource.name,
                  type: resource.type
                });
              }
            }
          });
        }

        // Look for next link in bundle
        nextUrl = null;
        if (bundle.link && Array.isArray(bundle.link)) {
          const nextLink = bundle.link.find((link: any) => link.relation === 'next');
          if (nextLink && nextLink.url) {
            nextUrl = nextLink.url;
          }
        }

        // Also stop if we got no new profiles (all duplicates)
        if (newProfilesCount === 0 && nextUrl) {
          nextUrl = null;
        }
      }
      this.structureDefinitions.set(allProfiles);
      this.isFetched.set(true);
      this.isLoading.set(false);
    } catch (err: any) {
      console.error('Error fetching StructureDefinitions:', err);
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
   * Uses _summary=false to ensure we get the full snapshot
   */
  async fetchSingleStructureDefinition(url: string): Promise<any | null> {
    try {
      const encodedUrl = encodeURIComponent(url);
      const query = `/administration/StructureDefinition?url=${encodedUrl}&_summary=false`;

      return new Promise((resolve, reject) => {
        this.fhirService.executeQuery(query).subscribe({
          next: (response: any) => {
            if (response.entry && response.entry.length > 0) {
              const sd = response.entry[0].resource;
              resolve(sd);
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
