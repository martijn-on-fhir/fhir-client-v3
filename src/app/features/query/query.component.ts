/**
 * FHIR Query Builder Component
 *
 * Visual query builder for constructing and executing FHIR queries.
 * Provides resource selection, search parameters, includes, modifiers,
 * query preview, execution, and results display.
 */

import {CommonModule} from '@angular/common';
import {Component, signal, computed, effect, inject, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {
  QueryParameter,
  SearchParameter,
} from '../../core/models/query-builder.model';
import {FhirService} from '../../core/services/fhir.service';
import {LoggerService} from '../../core/services/logger.service';
import {NavigationService} from '../../core/services/navigation.service';
import {QueryHistoryService} from '../../core/services/query-history.service';
import {JsonViewerToolbarComponent} from '../../shared/components/json-viewer-toolbar/json-viewer-toolbar.component';
import {MonacoEditorComponent} from '../../shared/components/monaco-editor/monaco-editor.component';

@Component({
  selector: 'app-query',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, JsonViewerToolbarComponent],
  templateUrl: './query.component.html',
  styleUrl: './query.component.scss',
})
export class QueryComponent implements OnInit {
  /**
   * Injected FHIR service for executing queries
   */
  private fhirService = inject(FhirService);

  /**
   * Injected logger service for logging
   */
  private loggerService = inject(LoggerService);

  /**
   * Injected navigation service for handling navigation events
   */
  private navigationService = inject(NavigationService);

  /**
   * Injected query history service for managing query history
   */
  private queryHistoryService = inject(QueryHistoryService);

  /**
   * Logger instance for this component
   */
  private get logger() {
    return this.loggerService.component('QueryComponent');
  }

  /**
   * Reference to Monaco Editor component in text mode
   */
  @ViewChild('component') component?: MonacoEditorComponent;

  /**
   * Reference to Monaco Editor component in visual builder mode
   */
  @ViewChild('componentVisual') componentVisual?: MonacoEditorComponent;

  /**
   * Indicates whether navigation back in query history is possible
   */
  canGoBack = computed(() => this.queryHistoryService.canNavigateBack());

  /**
   * Indicates whether navigation forward in query history is possible
   */
  canGoForward = computed(() => this.queryHistoryService.canNavigateForward());

  /**
   * FHIR server capability statement metadata
   */
  metadata = signal<any>(null);

  /**
   * Indicates whether metadata is being loaded
   */
  metadataLoading = signal(true);

  /**
   * Error message from metadata loading, if any
   */
  metadataError = signal<string | null>(null);

  /**
   * Currently selected FHIR resource type in visual builder
   */
  selectedResource = signal<string | null>(this.loadFromStorage('visual-builder-resource'));

  /**
   * Array of query parameters configured in visual builder
   */
  parameters = signal<QueryParameter[]>(this.loadParametersFromStorage());

  /**
   * Array of selected _include parameters
   */
  selectedIncludes = signal<string[]>(this.loadArrayFromStorage('visual-builder-includes'));

  /**
   * Array of selected _revinclude parameters
   */
  selectedRevIncludes = signal<string[]>(this.loadArrayFromStorage('visual-builder-revincludes'));

  /**
   * _count parameter value
   */
  count = signal<string>(this.loadFromStorage('visual-builder-count') || '');

  /**
   * _sort parameter value
   */
  sort = signal<string>(this.loadFromStorage('visual-builder-sort') || '');

  /**
   * _summary parameter value
   */
  summary = signal<string>(this.loadFromStorage('visual-builder-summary') || '');

  /**
   * Current query mode (text or visual builder)
   */
  queryMode = signal<'text' | 'visual'>(
    (localStorage.getItem('fhir-query-mode') as 'text' | 'visual') || 'text'
  );

  /**
   * Query string in text mode
   */
  textQuery = signal(localStorage.getItem('fhir-text-query') || '/Patient');

  /**
   * Whether the search box is shown in results
   */
  showSearch = signal(localStorage.getItem('visual-builder-show-search') === 'true');

  /**
   * Search term for filtering results
   */
  searchTerm = signal(localStorage.getItem('visual-builder-search-term') || '');

  /**
   * Collapsed level for JSON viewer (false means fully expanded)
   */
  collapsedLevel = signal<number | false>(this.loadCollapsedLevel());

  /**
   * Current page number for pagination
   */
  currentPage = signal(1);

  /**
   * Number of items to display per page
   */
  itemsPerPage = 10;

  /**
   * Whether the includes section is expanded
   */
  includesExpanded = signal(localStorage.getItem('visual-builder-includes-expanded') !== 'false');

  /**
   * Whether the reverse includes section is expanded
   */
  revIncludesExpanded = signal(localStorage.getItem('visual-builder-revincludes-expanded') === 'true');

  /**
   * Generated query string from visual builder
   */
  generatedQuery = signal('');

  /**
   * Indicates whether a query is being executed
   */
  loading = signal(false);

  /**
   * Error message from query execution, if any
   */
  error = signal<string | null>(null);

  /**
   * Query execution result
   */
  result = signal<any>(null);

  /**
   * Metadata for the currently selected resource type
   */
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

  /**
   * Array of all available FHIR resource types from server metadata
   */
  resourceTypes = computed(() => {
    const meta = this.metadata();

    if (!meta?.rest?.[0]?.resource) {
      return [];
    }

    const types = meta.rest[0].resource.map((r: any) => r.type).filter((t: string) => t);

    return types.sort();
  });

  /**
   * Array of available search parameters for the selected resource
   */
  availableSearchParams = computed(() => this.resourceMetadata()?.searchParam || []);

  /**
   * Array of search parameters not yet added to the query
   */
  unusedParams = computed(() => {
    const available = this.availableSearchParams();
    const used = this.parameters();

    return available.filter(
      (param: SearchParameter) => !used.find((p) => p.name === param.name)
    );
  });

  /**
   * Query result filtered by search term
   */
  filteredResult = computed(() => {
    const res = this.result();
    const search = this.searchTerm();

    if (!res || !search) {
      return res;
    }

    return this.filterJSON(res, search);
  });

  /**
   * Array of entries from the filtered result
   */
  entries = computed(() => this.filteredResult()?.entry || []);

  /**
   * Total number of pages based on filtered entries
   */
  totalPages = computed(() => Math.ceil(this.entries().length / this.itemsPerPage));

  /**
   * Array of page numbers for pagination
   */
  pageNumbers = computed(() => {
    const total = this.totalPages();

    return Array.from({length: total}, (_, i) => i + 1);
  });

  /**
   * Entries for the current page
   */
  paginatedEntries = computed(() => {
    const entries = this.entries();
    const page = this.currentPage();
    const start = (page - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;

    return entries.slice(start, end);
  });

  /**
   * Query result with entries limited to current page
   */
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

  /**
   * JSON string representation of paginated result for Monaco Editor
   */
  resultJson = computed(() => {
    const result = this.paginatedResult();

    return result ? JSON.stringify(result, null, 2) : '';
  });

  /**
   * Constructor initializes Angular effects for auto-saving state to localStorage
   * and handling various component behaviors
   */
  constructor() {
    effect(() => {
      localStorage.setItem('fhir-query-mode', this.queryMode());
    });

    effect(() => {
      localStorage.setItem('fhir-text-query', this.textQuery());
    });

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

    effect(() => {
      this.generatedQuery.set(this.generateQueryString());
    }, {allowSignalWrites: true});

    effect(() => {
      this.result();
      this.currentPage.set(1);
    }, {allowSignalWrites: true});

    effect(() => {
      const navEvent = this.navigationService.queryNavigationEvent();

      if (navEvent) {
        this.queryMode.set(navEvent.mode);

        if (navEvent.mode === 'text') {
          this.textQuery.set(`/${navEvent.resource}`);
          this.executeTextQuery();
        } else {
          this.selectedResource.set(navEvent.resource);
          this.executeQuery();
        }

        this.navigationService.clearQueryNavigationEvent();
      }
    }, {allowSignalWrites: true});
  }

  /**
   * Component initialization lifecycle hook
   * Loads FHIR server metadata on component initialization
   */
  async ngOnInit() {
    await this.loadMetadata();
  }

  /**
   * Loads FHIR server capability statement metadata
   * First attempts to load from local cache (electron-store), then fetches from server if not available
   * Handles Observable unwrapping if needed
   * @returns Promise that resolves when metadata is loaded
   */
  async loadMetadata() {
    this.metadataLoading.set(true);
    this.metadataError.set(null);

    try {
      let storedMetadata = await window.electronAPI?.metadata?.get();

      if (storedMetadata && typeof storedMetadata === 'object' && 'subscribe' in storedMetadata) {
        this.logger.info('Unwrapping Observable from electron store');
        storedMetadata = await firstValueFrom(storedMetadata as any);
      }

      if (!storedMetadata) {
        this.logger.info('Fetching metadata from FHIR server...');
        const result = await this.fhirService.getMetadata();

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
   * Generates a FHIR query string from the current visual builder state
   * Combines resource type, search parameters, includes, and modifiers into a complete query URL
   * @returns Complete FHIR query string (e.g., "/Patient?name=John&_count=10")
   */
  generateQueryString(): string {
    const resource = this.selectedResource();

    if (!resource) {
      return '';
    }

    let query = `/${resource}`;
    const parts: string[] = [];

    this.parameters().forEach((param) => {
      const validValues = param.values.filter((v) => v && String(v).trim() !== '');

      if (validValues.length === 0) {
        return;
      }

      let paramName = param.name;

      if (param.chain) {
        paramName = `${param.name}.${param.chain}`;
      }

      if (param.modifier) {
        paramName = `${paramName}:${param.modifier}`;
      }

      const operator = param.operator || '';
      const encodedValues = validValues.map((v) => encodeURIComponent(operator + v)).join(',');
      parts.push(`${paramName}=${encodedValues}`);
    });

    this.selectedIncludes().forEach((inc) => {
      parts.push(`_include=${inc}`);
    });

    this.selectedRevIncludes().forEach((rev) => {
      parts.push(`_revinclude=${rev}`);
    });

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
   * Executes the generated query from visual builder mode
   * @returns Promise that resolves when query execution completes
   */
  async executeQuery() {
    const query = this.generatedQuery();

    if (!query) {
      return;
    }
    await this.executeQueryString(query);
  }

  /**
   * Executes the query from text mode
   * @returns Promise that resolves when query execution completes
   */
  async executeTextQuery() {
    const query = this.textQuery();

    if (!query) {
      return;
    }
    await this.executeQueryString(query);
  }

  /**
   * Navigates to the previous query in history
   * Updates the text query with the previous query from history
   */
  navigateBack() {
    const previousQuery = this.queryHistoryService.navigateBack();

    if (previousQuery) {
      this.textQuery.set(previousQuery);
      this.logger.debug('Navigated to previous query:', previousQuery);
    }
  }

  /**
   * Navigates to the next query in history
   * Updates the text query with the next query from history
   */
  navigateForward() {
    const nextQuery = this.queryHistoryService.navigateForward();

    if (nextQuery) {
      this.textQuery.set(nextQuery);
      this.logger.debug('Navigated to next query:', nextQuery);
    }
  }

  /**
   * Executes a FHIR query string
   * Handles Observable unwrapping and adds successful queries to history
   * @param query FHIR query string to execute
   * @returns Promise that resolves when query execution completes
   */
  private async executeQueryString(query: string) {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.logger.info('Executing query:', query);
      let result = await this.fhirService.executeQuery(query);

      if (result && typeof result === 'object' && 'subscribe' in result) {
        this.logger.info('Unwrapping Observable from FHIR service');
        result = await firstValueFrom(result as any);
      }

      this.result.set(result);

      this.queryHistoryService.addQuery(query, this.queryMode());
    } catch (err: any) {
      this.logger.error('Query execution failed:', err);
      this.error.set(err.message || 'Query execution failed');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Switches between text and visual query modes
   * @param mode The mode to switch to ('text' or 'visual')
   */
  setQueryMode(mode: 'text' | 'visual') {
    this.queryMode.set(mode);
  }

  /**
   * Copies the generated query to clipboard
   * @returns Promise that resolves when copy operation completes
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
   * Clears all visual builder state including parameters, includes, and modifiers
   * Also removes corresponding localStorage entries
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
   * Handles resource selection change in visual builder
   * Clears all parameters when resource type changes
   * @param resource The selected resource type
   */
  onResourceChange(resource: string) {
    this.selectedResource.set(resource || null);
    this.parameters.set([]);
    this.selectedIncludes.set([]);
    this.selectedRevIncludes.set([]);
  }

  /**
   * Removes a query parameter at the specified index
   * @param index Index of the parameter to remove
   */
  removeParameter(index: number) {
    this.parameters.set(this.parameters().filter((_, i) => i !== index));
  }

  /**
   * Updates the operator for a query parameter (e.g., 'eq', 'gt', 'lt')
   * @param param The parameter to update
   * @param operator The new operator value
   */
  updateParameterOperator(param: QueryParameter, operator: string) {
    param.operator = operator;
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Updates the modifier for a query parameter (e.g., 'exact', 'contains')
   * @param param The parameter to update
   * @param modifier The new modifier value
   */
  updateParameterModifier(param: QueryParameter, modifier: string) {
    param.modifier = modifier;
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Updates the chain for a query parameter (for chained searches)
   * @param param The parameter to update
   * @param chain The new chain value
   */
  updateParameterChain(param: QueryParameter, chain: string) {
    param.chain = chain;
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Updates a specific value in a parameter's values array
   * @param param The parameter to update
   * @param valueIndex Index of the value to update
   * @param value The new value
   */
  updateParameterValue(param: QueryParameter, valueIndex: number, value: string) {
    param.values[valueIndex] = value;
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Removes a value from a parameter's values array
   * Ensures at least one value remains
   * @param param The parameter to update
   * @param valueIndex Index of the value to remove
   */
  removeParameterValue(param: QueryParameter, valueIndex: number) {
    param.values = param.values.filter((_, i) => i !== valueIndex);

    if (param.values.length === 0) {
      param.values = [''];
    }
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Adds an empty value to a parameter's values array
   * @param param The parameter to add a value to
   */
  addParameterValue(param: QueryParameter) {
    param.values = [...param.values, ''];
    this.parameters.set([...this.parameters()]);
  }

  /**
   * Adds a new query parameter by name
   * Initializes the parameter with default values
   * @param paramName Name of the parameter to add
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
   * Toggles an _include parameter
   * @param include The include parameter value
   * @param checked Whether to add or remove the include
   */
  toggleInclude(include: string, checked: boolean) {
    if (checked) {
      this.selectedIncludes.set([...this.selectedIncludes(), include]);
    } else {
      this.selectedIncludes.set(this.selectedIncludes().filter((i) => i !== include));
    }
  }

  /**
   * Toggles a _revinclude parameter
   * @param revInclude The revinclude parameter value
   * @param checked Whether to add or remove the revinclude
   */
  toggleRevInclude(revInclude: string, checked: boolean) {
    if (checked) {
      this.selectedRevIncludes.set([...this.selectedRevIncludes(), revInclude]);
    } else {
      this.selectedRevIncludes.set(this.selectedRevIncludes().filter((i) => i !== revInclude));
    }
  }

  /**
   * Handles checkbox change event for _include parameters
   * @param include The include parameter value
   * @param event The checkbox change event
   */
  onIncludeCheckChange(include: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleInclude(include, checked);
  }

  /**
   * Handles checkbox change event for _revinclude parameters
   * @param revInclude The revinclude parameter value
   * @param event The checkbox change event
   */
  onRevIncludeCheckChange(revInclude: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleRevInclude(revInclude, checked);
  }

  /**
   * Expands the JSON viewer by one level
   * If fully collapsed (level 1), fully expands the viewer
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
   * Collapses the JSON viewer by one level
   * If fully expanded, collapses to level 1
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
   * Recursively filters JSON object based on search term
   * Matches keys and values against the search term
   * @param obj The JSON object to filter
   * @param term The search term to filter by
   * @returns Filtered JSON object containing only matching keys/values
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
   * Loads a string value from localStorage
   * @param key The localStorage key
   * @returns The stored value or null if not found
   */
  private loadFromStorage(key: string): string | null {
    return localStorage.getItem(key);
  }

  /**
   * Loads an array from localStorage
   * Safely parses JSON, returning empty array on error
   * @param key The localStorage key
   * @returns The parsed array or empty array if not found/invalid
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
   * Loads query parameters from localStorage with migration support
   * Migrates old format (single value) to new format (array of values)
   * @returns Array of query parameters
   */
  private loadParametersFromStorage(): QueryParameter[] {
    const stored = localStorage.getItem('visual-builder-parameters');

    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored);

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
   * Loads the collapsed level setting from localStorage
   * @returns Collapsed level number or false for fully expanded
   */
  private loadCollapsedLevel(): number | false {
    const stored = localStorage.getItem('visual-builder-collapsed-level');

    if (stored === 'false') {
      return false;
    }

    return stored ? parseInt(stored, 10) : 4;
  }
}
