/**
 * FHIR Query Builder Component
 *
 * Visual query builder for constructing and executing FHIR queries.
 * Provides resource selection, search parameters, includes, modifiers,
 * query preview, execution, and results display.
 */

import { CommonModule } from '@angular/common';
import { Component, signal, computed, effect, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  QueryParameter,
  SearchParameter,
} from '../../core/models/query-builder.model';
import { FhirService } from '../../core/services/fhir.service';
import { LoggerService } from '../../core/services/logger.service';
import { NavigationService } from '../../core/services/navigation.service';
import { QueryHistoryService } from '../../core/services/query-history.service';
import { JsonViewerToolbarComponent } from '../../shared/components/json-viewer-toolbar/json-viewer-toolbar.component';
import { MonacoEditorComponent } from '../../shared/components/monaco-editor/monaco-editor.component';

@Component({
  selector: 'app-query',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, JsonViewerToolbarComponent],
  templateUrl: './query.component.html',
  styleUrl: './query.component.scss',
})
export class QueryComponent implements OnInit {
  private fhirService = inject(FhirService);
  private loggerService = inject(LoggerService);
  private navigationService = inject(NavigationService);
  private queryHistoryService = inject(QueryHistoryService);

  private get logger() {
    return this.loggerService.component('QueryComponent');
  }

  // Query history navigation
  canGoBack = computed(() => this.queryHistoryService.canNavigateBack());
  canGoForward = computed(() => this.queryHistoryService.canNavigateForward());

  // Metadata state
  metadata = signal<any>(null);
  metadataLoading = signal(true);
  metadataError = signal<string | null>(null);

  // Builder state
  selectedResource = signal<string | null>(this.loadFromStorage('visual-builder-resource'));
  parameters = signal<QueryParameter[]>(this.loadParametersFromStorage());
  selectedIncludes = signal<string[]>(this.loadArrayFromStorage('visual-builder-includes'));
  selectedRevIncludes = signal<string[]>(this.loadArrayFromStorage('visual-builder-revincludes'));
  count = signal<string>(this.loadFromStorage('visual-builder-count') || '');
  sort = signal<string>(this.loadFromStorage('visual-builder-sort') || '');
  summary = signal<string>(this.loadFromStorage('visual-builder-summary') || '');

  // Mode state
  queryMode = signal<'text' | 'visual'>(
    (localStorage.getItem('fhir-query-mode') as 'text' | 'visual') || 'text'
  );
  textQuery = signal(localStorage.getItem('fhir-text-query') || '/Patient');

  // UI state
  showSearch = signal(localStorage.getItem('visual-builder-show-search') === 'true');
  searchTerm = signal(localStorage.getItem('visual-builder-search-term') || '');
  collapsedLevel = signal<number | false>(this.loadCollapsedLevel());
  currentPage = signal(1);
  itemsPerPage = 10;
  includesExpanded = signal(localStorage.getItem('visual-builder-includes-expanded') !== 'false');
  revIncludesExpanded = signal(localStorage.getItem('visual-builder-revincludes-expanded') === 'true');

  // Query state
  generatedQuery = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  result = signal<any>(null);

  // Computed properties
  resourceMetadata = computed(() => {
    const meta = this.metadata();
    const resource = this.selectedResource();

    if (!meta || !resource) {
return null;
}

    return (
      meta.rest?.[0]?.resource?.find((r: any) => r.type === resource) || null
    );
  });

  resourceTypes = computed(() => {
    const meta = this.metadata();

    if (!meta?.rest?.[0]?.resource) {
      return [];
    }

    const types = meta.rest[0].resource
      .map((r: any) => r.type)
      .filter((t: string) => t);

    return types.sort();
  });

  availableSearchParams = computed(() => this.resourceMetadata()?.searchParam || []);

  unusedParams = computed(() => {
    const available = this.availableSearchParams();
    const used = this.parameters();

    return available.filter(
      (param: SearchParameter) => !used.find((p) => p.name === param.name)
    );
  });

  // Filtered and paginated results
  filteredResult = computed(() => {
    const res = this.result();
    const search = this.searchTerm();

    if (!res || !search) {
return res;
}

    return this.filterJSON(res, search);
  });

  entries = computed(() => this.filteredResult()?.entry || []);

  totalPages = computed(() => Math.ceil(this.entries().length / this.itemsPerPage));

  pageNumbers = computed(() => {
    const total = this.totalPages();

    return Array.from({ length: total }, (_, i) => i + 1);
  });

  paginatedEntries = computed(() => {
    const entries = this.entries();
    const page = this.currentPage();
    const start = (page - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;

    return entries.slice(start, end);
  });

  paginatedResult = computed(() => {
    const filtered = this.filteredResult();

    if (!filtered?.entry) {
return filtered;
}

    return {
      ...filtered,
      entry: this.paginatedEntries(),
    };
  });

  // JSON string for Monaco Editor
  resultJson = computed(() => {
    const result = this.paginatedResult();

    return result ? JSON.stringify(result, null, 2) : '';
  });

  constructor() {
    // Auto-save query mode
    effect(() => {
      localStorage.setItem('fhir-query-mode', this.queryMode());
    });

    // Auto-save text query
    effect(() => {
      localStorage.setItem('fhir-text-query', this.textQuery());
    });

    // Auto-save builder state to localStorage
    effect(() => {
      const resource = this.selectedResource();

      if (resource) {
        localStorage.setItem('visual-builder-resource', resource);
      } else {
        localStorage.removeItem('visual-builder-resource');
      }
    });

    effect(() => {
      localStorage.setItem('visual-builder-parameters', JSON.stringify(this.parameters()));
    });

    effect(() => {
      localStorage.setItem('visual-builder-includes', JSON.stringify(this.selectedIncludes()));
    });

    effect(() => {
      localStorage.setItem('visual-builder-revincludes', JSON.stringify(this.selectedRevIncludes()));
    });

    effect(() => {
      localStorage.setItem('visual-builder-count', this.count());
    });

    effect(() => {
      localStorage.setItem('visual-builder-sort', this.sort());
    });

    effect(() => {
      localStorage.setItem('visual-builder-summary', this.summary());
    });

    effect(() => {
      localStorage.setItem('visual-builder-show-search', String(this.showSearch()));
    });

    effect(() => {
      localStorage.setItem('visual-builder-search-term', this.searchTerm());
    });

    effect(() => {
      localStorage.setItem('visual-builder-collapsed-level', String(this.collapsedLevel()));
    });

    effect(() => {
      localStorage.setItem('visual-builder-includes-expanded', String(this.includesExpanded()));
    });

    effect(() => {
      localStorage.setItem('visual-builder-revincludes-expanded', String(this.revIncludesExpanded()));
    });

    // Generate query whenever builder state changes
    effect(() => {

      this.generatedQuery.set(this.generateQueryString());
    }, { allowSignalWrites: true });

    // Reset page when results change
    effect(() => {
      this.result();
      this.currentPage.set(1);
    }, { allowSignalWrites: true });

    // Handle navigation events from sidebar
    effect(() => {
      const navEvent = this.navigationService.queryNavigationEvent();

      if (navEvent) {
        // Switch to specified mode
        this.queryMode.set(navEvent.mode);

        // Set the query based on mode
        if (navEvent.mode === 'text') {
          this.textQuery.set(`/${navEvent.resource}`);
          // Execute the query immediately
          this.executeTextQuery();
        } else {
          this.selectedResource.set(navEvent.resource);
          // Execute the query immediately
          this.executeQuery();
        }

        // Clear the event
        this.navigationService.clearQueryNavigationEvent();
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit() {
    await this.loadMetadata();
  }

  /**
   * Load metadata from cache or server
   */
  async loadMetadata() {
    this.metadataLoading.set(true);
    this.metadataError.set(null);

    try {
      // Try to load from electron-store first
      let storedMetadata = await window.electronAPI?.metadata?.get();

      // Check if it's an Observable and unwrap it
      if (storedMetadata && typeof storedMetadata === 'object' && 'subscribe' in storedMetadata) {
        this.logger.info('Unwrapping Observable from electron store');
        storedMetadata = await firstValueFrom(storedMetadata as any);
      }

      // If not in storage, fetch from server
      if (!storedMetadata) {
        this.logger.info('Fetching metadata from FHIR server...');
        const result = await this.fhirService.getMetadata();

        // Check if result is Observable
        if (result && typeof result === 'object' && 'subscribe' in result) {
          this.logger.info('Unwrapping Observable from FHIR service');
          storedMetadata = await firstValueFrom(result as any);
        } else {
          storedMetadata = result;
        }
      }

      if (storedMetadata) {
        this.metadata.set(storedMetadata);
        const resourceCount = storedMetadata?.rest?.[0]?.resource?.length || 0;
        this.logger.info('Metadata loaded successfully with', resourceCount, 'resource types');
      } else {
        this.metadataError.set('Metadata not available');
      }
    } catch (err: any) {
      this.logger.error('Failed to load metadata:', err);
      this.metadataError.set(err.message || 'Failed to load metadata');
    } finally {
      this.metadataLoading.set(false);
    }
  }

  /**
   * Generate FHIR query string from current state
   */
  generateQueryString(): string {
    const resource = this.selectedResource();

    if (!resource) {
return '';
}

    let query = `/${resource}`;
    const parts: string[] = [];

    // Add search parameters
    this.parameters().forEach((param) => {
      const validValues = param.values.filter((v) => v && String(v).trim() !== '');

      if (validValues.length === 0) {
return;
}

      // Build parameter name with chain and/or modifier
      let paramName = param.name;

      if (param.chain) {
        paramName = `${param.name}.${param.chain}`;
      }

      if (param.modifier) {
        paramName = `${paramName}:${param.modifier}`;
      }

      // Apply prefix operator if present
      const operator = param.operator || '';
      const encodedValues = validValues
        .map((v) => encodeURIComponent(operator + v))
        .join(',');
      parts.push(`${paramName}=${encodedValues}`);
    });

    // Add includes
    this.selectedIncludes().forEach((inc) => {
      parts.push(`_include=${inc}`);
    });

    // Add reverse includes
    this.selectedRevIncludes().forEach((rev) => {
      parts.push(`_revinclude=${rev}`);
    });

    // Add modifiers
    const cnt = this.count();
    const srt = this.sort();
    const sum = this.summary();

    if (cnt) {
parts.push(`_count=${cnt}`);
}

    if (srt) {
parts.push(`_sort=${srt}`);
}

    if (sum) {
parts.push(`_summary=${sum}`);
}

    if (parts.length > 0) {
      query += '?' + parts.join('&');
    }

    return query;
  }

  /**
   * Execute the generated query (visual mode)
   */
  async executeQuery() {
    const query = this.generatedQuery();

    if (!query) {
return;
}
    await this.executeQueryString(query);
  }

  /**
   * Execute text query (text mode)
   */
  async executeTextQuery() {
    const query = this.textQuery();

    if (!query) {
return;
}
    await this.executeQueryString(query);
  }

  /**
   * Navigate to previous query in history
   */
  navigateBack() {
    const previousQuery = this.queryHistoryService.navigateBack();
    if (previousQuery) {
      this.textQuery.set(previousQuery);
      this.logger.debug('Navigated to previous query:', previousQuery);
    }
  }

  /**
   * Navigate to next query in history
   */
  navigateForward() {
    const nextQuery = this.queryHistoryService.navigateForward();
    if (nextQuery) {
      this.textQuery.set(nextQuery);
      this.logger.debug('Navigated to next query:', nextQuery);
    }
  }

  /**
   * Execute a query string
   */
  private async executeQueryString(query: string) {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.logger.info('Executing query:', query);
      let result = await this.fhirService.executeQuery(query);

      // Check if result is Observable and unwrap it
      if (result && typeof result === 'object' && 'subscribe' in result) {
        this.logger.info('Unwrapping Observable from FHIR service');
        result = await firstValueFrom(result as any);
      }

      this.result.set(result);
      this.logger.info('Query executed successfully');

      // Add to history after successful execution
      this.queryHistoryService.addQuery(query, this.queryMode());
    } catch (err: any) {
      this.logger.error('Query execution failed:', err);
      this.error.set(err.message || 'Query execution failed');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Switch query mode
   */
  setQueryMode(mode: 'text' | 'visual') {
    this.queryMode.set(mode);
  }

  /**
   * Copy query to clipboard
   */
  async copyQuery() {
    const query = this.generatedQuery();

    if (!query) {
return;
}

    try {
      await navigator.clipboard.writeText(query);
      this.logger.info('Query copied to clipboard');
    } catch (err) {
      this.logger.error('Failed to copy query:', err);
    }
  }

  /**
   * Clear all builder state
   */
  clearAll() {
    this.parameters.set([]);
    this.selectedIncludes.set([]);
    this.selectedRevIncludes.set([]);
    this.count.set('');
    this.sort.set('');
    this.summary.set('');

    localStorage.removeItem('visual-builder-parameters');
    localStorage.removeItem('visual-builder-includes');
    localStorage.removeItem('visual-builder-revincludes');
    localStorage.removeItem('visual-builder-count');
    localStorage.removeItem('visual-builder-sort');
    localStorage.removeItem('visual-builder-summary');
  }

  /**
   * Handle resource selection change
   */
  onResourceChange(resource: string) {
    this.selectedResource.set(resource || null);
    // Clear all parameters when resource changes
    this.parameters.set([]);
    this.selectedIncludes.set([]);
    this.selectedRevIncludes.set([]);
  }

  /**
   * Remove parameter at index
   */
  removeParameter(index: number) {
    this.parameters.set(this.parameters().filter((_, i) => i !== index));
  }

  /**
   * Update parameter operator
   */
  updateParameterOperator(param: QueryParameter, operator: string) {
    param.operator = operator;
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Update parameter modifier
   */
  updateParameterModifier(param: QueryParameter, modifier: string) {
    param.modifier = modifier;
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Update parameter chain
   */
  updateParameterChain(param: QueryParameter, chain: string) {
    param.chain = chain;
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Update parameter value
   */
  updateParameterValue(param: QueryParameter, valueIndex: number, value: string) {
    param.values[valueIndex] = value;
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Remove value from parameter
   */
  removeParameterValue(param: QueryParameter, valueIndex: number) {
    param.values = param.values.filter((_, i) => i !== valueIndex);

    // Keep at least one value
    if (param.values.length === 0) {
      param.values = [''];
    }
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Add value to parameter
   */
  addParameterValue(param: QueryParameter) {
    param.values = [...param.values, ''];
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Add parameter by name
   */
  addParameter(paramName: string) {
    if (!paramName) {
return;
}

    const paramDef = this.availableSearchParams().find((p: SearchParameter) => p.name === paramName);

    if (!paramDef) {
return;
}

    this.parameters.set([
      ...this.parameters(),
      {
        name: paramDef.name,
        type: paramDef.type,
        operator: '',
        modifier: '',
        values: [''],
        chain: '',
      },
    ]);
  }

  /**
   * Toggle include
   */
  toggleInclude(include: string, checked: boolean) {
    if (checked) {
      this.selectedIncludes.set([...this.selectedIncludes(), include]);
    } else {
      this.selectedIncludes.set(this.selectedIncludes().filter((i) => i !== include));
    }
  }

  /**
   * Toggle reverse include
   */
  toggleRevInclude(revInclude: string, checked: boolean) {
    if (checked) {
      this.selectedRevIncludes.set([...this.selectedRevIncludes(), revInclude]);
    } else {
      this.selectedRevIncludes.set(this.selectedRevIncludes().filter((i) => i !== revInclude));
    }
  }

  /**
   * Handle checkbox change event
   */
  onIncludeCheckChange(include: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleInclude(include, checked);
  }

  /**
   * Handle reverse include checkbox change event
   */
  onRevIncludeCheckChange(revInclude: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleRevInclude(revInclude, checked);
  }

  /**
   * Expand one collapsed level
   */
  expandOneLevel() {
    const level = this.collapsedLevel();

    if (level === false) {
return;
}

    if (level === 1) {
      this.collapsedLevel.set(false);
    } else {
      this.collapsedLevel.set((level as number) - 1);
    }
  }

  /**
   * Collapse one level
   */
  collapseOneLevel() {
    const level = this.collapsedLevel();

    if (level === false) {
      this.collapsedLevel.set(1);
    } else {
      this.collapsedLevel.set((level as number) + 1);
    }
  }

  /**
   * Filter JSON recursively based on search term
   */
  private filterJSON(obj: any, term: string): any {
    if (!term) {
return obj;
}
    const searchLower = term.toLowerCase();

    const filter = (data: any): any => {
      if (data === null || data === undefined) {
return null;
}

      if (typeof data !== 'object') {
        return String(data).toLowerCase().includes(searchLower) ? data : null;
      }

      if (Array.isArray(data)) {
        const filtered = data.map((item) => filter(item)).filter((item) => item !== null);

        return filtered.length > 0 ? filtered : null;
      }

      const filteredObj: any = {};
      let hasMatch = false;
      for (const key in data) {
        const keyMatches = key.toLowerCase().includes(searchLower);
        const filteredValue = filter(data[key]);

        if (keyMatches || filteredValue !== null) {
          filteredObj[key] = keyMatches ? data[key] : filteredValue;
          hasMatch = true;
        }
      }

      return hasMatch ? filteredObj : null;
    };

    return filter(obj) || {};
  }

  /**
   * Load value from localStorage
   */
  private loadFromStorage(key: string): string | null {
    return localStorage.getItem(key);
  }

  /**
   * Load array from localStorage
   */
  private loadArrayFromStorage(key: string): string[] {
    const stored = localStorage.getItem(key);

    if (!stored) {
return [];
}

    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  /**
   * Load parameters from localStorage with migration
   */
  private loadParametersFromStorage(): QueryParameter[] {
    const stored = localStorage.getItem('visual-builder-parameters');

    if (!stored) {
return [];
}

    try {
      const parsed = JSON.parse(stored);

      // Migrate old format (value: string) to new format (values: string[])
      return parsed.map((param: any) => ({
        name: param.name,
        type: param.type,
        operator: param.operator || '',
        modifier: param.modifier || '',
        values: Array.isArray(param.values) ? param.values : [param.value || ''],
        chain: param.chain || '',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Load collapsed level from localStorage
   */
  private loadCollapsedLevel(): number | false {
    const stored = localStorage.getItem('visual-builder-collapsed-level');

    if (stored === 'false') {
return false;
}

    return stored ? parseInt(stored, 10) : 4;
  }
}
