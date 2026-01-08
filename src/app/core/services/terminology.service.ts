import { Injectable, signal } from '@angular/core';

/**
 * Terminology Service
 *
 * Provides access to the FHIR Terminology Server (terminologieserver.nl) via Electron IPC
 * Supports: CodeSystem/$lookup, ValueSet/$expand, ValueSet/$validate-code, ConceptMap/$translate
 *
 * Note: Uses Electron's main process for terminology requests to bypass CORS restrictions
 * and handle OAuth2 authentication automatically
 */

// Operation parameter interfaces
export interface LookupParams {
  system: string;
  code: string;
  version?: string;
  displayLanguage?: string;
  property?: string; // "designation" or "definition"
}

export interface ExpandParams {
  url: string;
  filter?: string;
  count?: number;
  offset?: number;
  includeDesignations?: boolean;
  displayLanguage?: string;
}

export interface ValidateCodeParams {
  url: string;
  code: string;
  system: string;
  display?: string;
  version?: string;
}

export interface TranslateParams {
  url: string;
  code: string;
  system: string;
  source?: string;
  target?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TerminologyService {
  // Loading state
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * CodeSystem/$lookup - Get code details
   */
  async lookup(params: LookupParams): Promise<any> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await (window as any).electronAPI.terminology.lookup(params);
      console.log('[TerminologyService] Lookup result:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Lookup operation failed';
      this.error.set(errorMsg);
      console.error('[TerminologyService] Lookup failed:', errorMsg);
      throw new Error(errorMsg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * ValueSet/$expand - Expand value set to concrete codes
   */
  async expand(params: ExpandParams): Promise<any> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await (window as any).electronAPI.terminology.expand(params);
      console.log('[TerminologyService] Expand result:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Expand operation failed';
      this.error.set(errorMsg);
      console.error('[TerminologyService] Expand failed:', errorMsg);
      throw new Error(errorMsg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * ValueSet/$validate-code - Validate code membership
   */
  async validateCode(params: ValidateCodeParams): Promise<any> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await (window as any).electronAPI.terminology.validateCode(params);
      console.log('[TerminologyService] Validate result:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Validate operation failed';
      this.error.set(errorMsg);
      console.error('[TerminologyService] Validate failed:', errorMsg);
      throw new Error(errorMsg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * ConceptMap/$translate - Translate codes between systems
   */
  async translate(params: TranslateParams): Promise<any> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await (window as any).electronAPI.terminology.translate(params);
      console.log('[TerminologyService] Translate result:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Translate operation failed';
      this.error.set(errorMsg);
      console.error('[TerminologyService] Translate failed:', errorMsg);
      throw new Error(errorMsg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Get server metadata (CapabilityStatement)
   */
  async getMetadata(): Promise<any> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await (window as any).electronAPI.terminology.getMetadata();
      console.log('[TerminologyService] Metadata:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch metadata';
      this.error.set(errorMsg);
      console.error('[TerminologyService] Get metadata failed:', errorMsg);
      throw new Error(errorMsg);
    } finally {
      this.loading.set(false);
    }
  }
}
