import { Injectable, signal, inject } from '@angular/core';
import { LoggerService } from './logger.service';

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
  private loggerService = inject(LoggerService);
  private logger = this.loggerService.component('TerminologyService');

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
      this.logger.info('Lookup result:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Lookup operation failed';
      this.error.set(errorMsg);
      this.logger.error('Lookup failed:', errorMsg);
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
      this.logger.info('Expand result:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Expand operation failed';
      this.error.set(errorMsg);
      this.logger.error('Expand failed:', errorMsg);
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
      this.logger.info('Validate result:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Validate operation failed';
      this.error.set(errorMsg);
      this.logger.error('Validate failed:', errorMsg);
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
      this.logger.info('Translate result:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Translate operation failed';
      this.error.set(errorMsg);
      this.logger.error('Translate failed:', errorMsg);
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
      this.logger.info('Metadata:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch metadata';
      this.error.set(errorMsg);
      this.logger.error('Get metadata failed:', errorMsg);
      throw new Error(errorMsg);
    } finally {
      this.loading.set(false);
    }
  }
}
