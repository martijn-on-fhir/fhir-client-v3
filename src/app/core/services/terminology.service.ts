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

/**
 * Parameters for CodeSystem/$lookup operation
 */
export interface LookupParams {
  /**
   * The code system URI
   */
  system: string;

  /**
   * The code to look up
   */
  code: string;

  /**
   * The version of the code system
   */
  version?: string;

  /**
   * The language for display text
   */
  displayLanguage?: string;

  /**
   * Additional properties to include (e.g., "designation" or "definition")
   */
  property?: string;
}

/**
 * Parameters for ValueSet/$expand operation
 */
export interface ExpandParams {
  /**
   * The canonical URL of the value set to expand
   */
  url: string;

  /**
   * Filter text to narrow the expansion
   */
  filter?: string;

  /**
   * Maximum number of codes to return
   */
  count?: number;

  /**
   * Starting position for paging
   */
  offset?: number;

  /**
   * Whether to include designations in the expansion
   */
  includeDesignations?: boolean;

  /**
   * The language for display text
   */
  displayLanguage?: string;
}

/**
 * Parameters for ValueSet/$validate-code operation
 */
export interface ValidateCodeParams {
  /**
   * The canonical URL of the value set to validate against
   */
  url: string;

  /**
   * The code to validate
   */
  code: string;

  /**
   * The code system URI
   */
  system: string;

  /**
   * The display text for the code
   */
  display?: string;

  /**
   * The version of the code system
   */
  version?: string;
}

/**
 * Parameters for ConceptMap/$translate operation
 */
export interface TranslateParams {
  /**
   * The canonical URL of the concept map
   */
  url: string;

  /**
   * The code to translate
   */
  code: string;

  /**
   * The source code system URI
   */
  system: string;

  /**
   * The source value set canonical URL
   */
  source?: string;

  /**
   * The target value set canonical URL
   */
  target?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TerminologyService {
  /**
   * Injected logger service instance
   */
  private loggerService = inject(LoggerService);

  /**
   * Logger instance for this service
   */
  private logger = this.loggerService.component('TerminologyService');

  /**
   * Indicates whether a terminology operation is currently in progress
   */
  readonly loading = signal(false);

  /**
   * Contains the last error message, if any
   */
  readonly error = signal<string | null>(null);

  /**
   * Performs a CodeSystem/$lookup operation to retrieve details about a specific code
   * @param params Lookup parameters including system and code
   * @returns Promise resolving to the lookup result from the terminology server
   * @throws Error if the lookup operation fails
   */
  async lookup(params: LookupParams): Promise<any> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await (window as any).electronAPI.terminology.lookup(params);
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
   * Performs a ValueSet/$expand operation to expand a value set into its concrete codes
   * @param params Expand parameters including value set URL and optional filters
   * @returns Promise resolving to the expansion result containing the list of codes
   * @throws Error if the expand operation fails
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
   * Performs a ValueSet/$validate-code operation to check if a code is a member of a value set
   * @param params Validation parameters including value set URL, code, and system
   * @returns Promise resolving to the validation result indicating membership
   * @throws Error if the validate operation fails
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
   * Performs a ConceptMap/$translate operation to translate codes from one system to another
   * @param params Translation parameters including concept map URL, code, and system
   * @returns Promise resolving to the translation result with equivalent codes
   * @throws Error if the translate operation fails
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
   * Retrieves the terminology server's metadata (CapabilityStatement)
   * @returns Promise resolving to the server's capability statement
   * @throws Error if metadata retrieval fails
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
