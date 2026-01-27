/**
 * FHIR Query Builder Component
 *
 * Visual query builder for constructing and executing FHIR queries.
 * Provides resource selection, search parameters, includes, modifiers,
 * query preview, execution, and results display.
 */

import {CommonModule} from '@angular/common';
import {Component, signal, computed, effect, inject, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy, DestroyRef} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {firstValueFrom, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';
import {
  QueryParameter,
  SearchParameter,
} from '../../core/models/query-builder.model';
import {EditorStateService} from '../../core/services/editor-state.service';
import {FavoritesService} from '../../core/services/favorites.service';
import {FhirService} from '../../core/services/fhir.service';
import {LoggerService} from '../../core/services/logger.service';
import {NavigationService} from '../../core/services/navigation.service';
import {QueryAutocompleteService, Suggestion} from '../../core/services/query-autocomplete.service';
import {QueryHistoryService} from '../../core/services/query-history.service';
import {QueryStateService} from '../../core/services/query-state.service';
import {RecentResourcesService} from '../../core/services/recent-resources.service';
import {ToastService} from '../../core/services/toast.service';
import {FhirQueryValidator} from '../../core/utils/fhir-query-string-validator'
import {MonacoEditorComponent} from '../../shared/components/monaco-editor/monaco-editor.component';
import {QueryAnalyticsDialogComponent} from '../../shared/components/query-analytics-dialog/query-analytics-dialog.component';
import {RequestInspectorDialogComponent} from '../../shared/components/request-inspector-dialog/request-inspector-dialog.component';
import {ResourceDiffDialogComponent} from '../../shared/components/resource-diff-dialog/resource-diff-dialog.component';
import {ResultHeaderComponent} from '../../shared/components/result-header/result-header.component';

@Component({
  selector: 'app-query',
  standalone: true,
  imports: [CommonModule, FormsModule, MonacoEditorComponent, ResultHeaderComponent, ResourceDiffDialogComponent, RequestInspectorDialogComponent, QueryAnalyticsDialogComponent],
  templateUrl: './query.component.html',
  styleUrl: './query.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryComponent implements OnInit, OnDestroy {
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
   * Injected editor state service for file operations
   */
  private editorStateService = inject(EditorStateService);

  /**
   * Injected autocomplete service for query suggestions
   */
  private autocompleteService = inject(QueryAutocompleteService);

  /**
   * Injected toast service for notifications
   */
  private toastService = inject(ToastService);

  /**
   * Injected router for navigation
   */
  private router = inject(Router);

  /**
   * Injected query state service for persisting state across tab navigation
   */
  private queryStateService = inject(QueryStateService);

  /**
   * Injected favorites service for managing favorite queries
   */
  private favoritesService = inject(FavoritesService);

  /**
   * Injected recent resources service for tracking viewed resources
   */
  private recentResourcesService = inject(RecentResourcesService);

  /**
   * DestroyRef for managing subscriptions
   */
  private destroyRef = inject(DestroyRef);

  /**
   * Logger instance for this component
   */
  private get logger() {
    return this.loggerService.component('QueryComponent');
  }

  /**
   * Cache for filtered JSON results to avoid redundant processing
   */
  private filterCache = new Map<string, any>();

  /**
   * Subject for debouncing search term input
   */
  private searchTermSubject = new Subject<string>();

  /**
   * Reference to Monaco Editor component in text mode
   */
  @ViewChild('component') component?: MonacoEditorComponent;

  /**
   * Reference to Monaco Editor component in visual builder mode
   */
  @ViewChild('componentVisual') componentVisual?: MonacoEditorComponent;

  /**
   * Signal for text mode editor (avoids ExpressionChangedAfterItHasBeenCheckedError)
   */
  textModeEditor = signal<any>(null);

  /**
   * Signal for visual mode editor (avoids ExpressionChangedAfterItHasBeenCheckedError)
   */
  visualModeEditor = signal<any>(null);

  /**
   * Reference to text query input element
   */
  @ViewChild('textQueryInput') textQueryInput?: ElementRef<HTMLInputElement>;

  /**
   * Reference to resource diff dialog
   */
  @ViewChild('diffDialog') diffDialog?: ResourceDiffDialogComponent;

  /**
   * Reference to request inspector dialog
   */
  @ViewChild('inspectorDialog') inspectorDialog?: RequestInspectorDialogComponent;

  /**
   * Reference to query analytics dialog
   */
  @ViewChild('analyticsDialog') analyticsDialog?: QueryAnalyticsDialogComponent;

  /**
   * Autocomplete suggestions for text mode
   */
  autocompleteSuggestions = signal<Suggestion[]>([]);

  /**
   * Whether to show autocomplete dropdown
   */
  showAutocomplete = signal(false);

  /**
   * Currently selected autocomplete suggestion index
   */
  autocompleteSelectedIndex = signal(-1);

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
   * Display format for query results (JSON or XML)
   */
  displayFormat = signal<'json' | 'xml'>(
    (localStorage.getItem('fhir-display-format') as 'json' | 'xml') || 'json'
  );

  /**
   * Raw XML result when format is XML
   */
  resultXml = signal<string | null>(null);

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
   * Last executed query string (for cURL generation)
   */
  lastExecutedQuery = signal<string | null>(null);

  /**
   * Query execution time in milliseconds
   */
  executionTime = signal<number | null>(null);

  /**
   * Response size in bytes
   */
  responseSize = signal<number | null>(null);

  /**
   * Pagination links from Bundle result
   */
  paginationLinks = computed(() => {
    const res = this.result();

    if (!res?.link || !Array.isArray(res.link)) {
      return [];
    }

    return res.link;
  });

  /**
   * Whether Bundle has navigation links (first, previous, next, last)
   * Used to determine if server-side pagination is available
   */
  hasBundleNavLinks = computed(() => {
    const links = this.paginationLinks();
    const navRelations = ['first', 'previous', 'prev', 'next', 'last'];

    return links.some((link: { relation: string }) => navRelations.includes(link.relation));
  });

  /**
   * Whether to show client-side pagination
   * True when there are many entries but no Bundle navigation links
   */
  showClientPagination = computed(() => !this.hasBundleNavLinks() && this.entries().length > this.itemsPerPage);

  /**
   * Total count from Bundle result
   */
  resultTotal = computed(() => {
    const res = this.result();

    return res?.total;
  });

  /**
   * Whether the result is a single FHIR resource (not a Bundle)
   * Used to show/hide the edit button
   */
  isSingleResource = computed(() => {
    const res = this.result();

    return res?.resourceType && res.resourceType !== 'Bundle';
  });

  /**
   * Whether the delete button should be shown
   * True when result is a single resource with an id
   */
  canDeleteResource = computed(() => {
    const res = this.result();

    return res?.resourceType && res.resourceType !== 'Bundle' && res.id;
  });

  /**
   * Whether the copy as cURL button should be shown
   * True when a query has been executed
   */
  canCopyAsCurl = computed(() => !!this.lastExecutedQuery());

  /**
   * Whether the $everything button should be shown
   * True when result is a Patient or Encounter with an id
   */
  canExecuteEverything = computed(() => {
    const res = this.result();
    const supportedTypes = ['Patient', 'Encounter'];

    return res?.resourceType && supportedTypes.includes(res.resourceType) && res.id;
  });

  /**
   * Whether the favorite button should be shown
   * True when a result exists (any query with results)
   */
  canFavorite = computed(() => !!this.result());

  /**
   * Whether the current query is favorited
   */
  isCurrentQueryFavorited = computed(() => {
    const query = this.getCurrentQuery();

    return query ? this.favoritesService.isFavorite(query) : false;
  });

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
   * String representation of result for Monaco Editor
   * Returns JSON or XML based on displayFormat
   */
  resultJson = computed(() => {
    const format = this.displayFormat();

    if (format === 'xml') {
      return this.resultXml() || '';
    }

    const result = this.filteredResult();

    return result ? JSON.stringify(result, null, 2) : '';
  });

  /**
   * Language for Monaco Editor based on display format
   */
  editorLanguage = computed(() => this.displayFormat());

  /**
   * Creates an instance of QueryComponent
   *
   * Sets up reactive effects for:
   * - Auto-saving query state to localStorage (query mode, text query, visual builder parameters)
   * - Auto-generating query strings from visual builder state
   * - Resetting pagination when results change
   * - Handling navigation events from other components
   * - Registering Monaco editor with EditorStateService when results are available
   * (with retry mechanism for async Monaco loading, tracking both query mode and results)
   */
  constructor() {
    // Debounce search term input for better performance
    this.searchTermSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.searchTerm.set(term);
    });

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
      localStorage.setItem('fhir-display-format', this.displayFormat());
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

    effect(() => {
      const favEvent = this.navigationService.favoriteQueryEvent();

      if (favEvent) {
        this.queryMode.set('text');
        this.textQuery.set(favEvent.query);
        this.executeTextQuery();
        this.navigationService.clearFavoriteQueryEvent();
      }
    }, {allowSignalWrites: true});

    effect(() => {
      const hasResults = this.resultJson() !== '';
      const mode = this.queryMode();

      if (hasResults) {
        setTimeout(() => {
          const activeEditor = mode === 'text' ? this.component : this.componentVisual;

          if (activeEditor?.editor) {
            this.editorStateService.registerEditor(activeEditor, false, '/app/query');
            this.logger.info(`Query editor registered as read-only (${mode} mode)`);
          } else {
            setTimeout(() => {
              const retryEditor = mode === 'text' ? this.component : this.componentVisual;

              if (retryEditor?.editor) {
                this.editorStateService.registerEditor(retryEditor, false, '/app/query');
                this.logger.info(`Query editor registered as read-only (${mode} mode)`);
              }
            }, 200);
          }
        }, 100);
      }
    });
  }

  /**
   * Component initialization lifecycle hook
   * Loads FHIR server metadata on component initialization
   */
  async ngOnInit() {
    await this.loadMetadata();

    // Check if we should auto-execute (e.g., coming from reference graph)
    const executeOnLoad = localStorage.getItem('fhir-execute-on-load');

    if (executeOnLoad === 'true') {
      localStorage.removeItem('fhir-execute-on-load');
      // Re-read query from localStorage as it may have been updated
      const query = localStorage.getItem('fhir-text-query');

      if (query) {
        this.textQuery.set(query);
        this.executeTextQuery();

        return;
      }
    }

    // Restore state from query state service (persists across tab navigation)
    if (this.queryStateService.hasResult()) {
      this.result.set(this.queryStateService.result());
      this.queryMode.set(this.queryStateService.queryMode());
      this.currentPage.set(this.queryStateService.currentPage());
      this.executionTime.set(this.queryStateService.executionTime());
      this.responseSize.set(this.queryStateService.responseSize());
      this.logger.debug('Restored query state from service');
    }
  }

  /**
   * Component destruction lifecycle hook
   * Unregisters editor from EditorStateService
   */
  ngOnDestroy() {
    this.editorStateService.unregisterEditor('/app/query');
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
          storedMetadata = await firstValueFrom(result as any);
        } else {
          storedMetadata = result;
        }
      }

      if (storedMetadata) {
        this.metadata.set(storedMetadata);
        // Set metadata for autocomplete service
        this.autocompleteService.setMetadata(storedMetadata);
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
   * Updates the text query and executes it
   */
  navigateBack() {
    const previousQuery = this.queryHistoryService.navigateBack();

    if (previousQuery) {
      this.textQuery.set(previousQuery);
      this.logger.debug('Navigated to previous query:', previousQuery);
      this.executeTextQuery();
    }
  }

  /**
   * Navigates to the next query in history
   * Updates the text query and executes it
   */
  navigateForward() {
    const nextQuery = this.queryHistoryService.navigateForward();

    if (nextQuery) {
      this.textQuery.set(nextQuery);
      this.logger.debug('Navigated to next query:', nextQuery);
      this.executeTextQuery();
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

    const validator = new FhirQueryValidator({
      strictMode: true
    });

    const validationResult = validator.validate(query);

    if(!validationResult.valid) {

      this.loading.set(false);
      this.result.set(validationResult);

      this.logger.error('Failed to validate query:', validationResult);

      return
    }

    const format = this.displayFormat();

    try {
      const startTime = performance.now();

      const result = await firstValueFrom(this.fhirService.executeQueryWithFormat(query, format));

      const endTime = performance.now();
      const execTime = Math.round(endTime - startTime);

      // Calculate response size
      const responseStr: string = format === 'xml' ? result as string : JSON.stringify(result);
      const respSize = new Blob([responseStr]).size;

      if (format === 'xml') {
        // Store XML string separately
        this.resultXml.set(result as string);
        // Parse XML to extract Bundle info for pagination
        const bundleInfo = this.parseXmlBundleInfo(result as string);
        this.result.set(bundleInfo);
      } else {
        this.result.set(result);
        this.resultXml.set(null);
      }

      this.lastExecutedQuery.set(query);
      this.executionTime.set(execTime);
      this.responseSize.set(respSize);
      this.queryStateService.setResult(result, execTime, respSize);
      this.queryStateService.setQueryMode(this.queryMode());
      this.queryHistoryService.addQuery(query, this.queryMode(), { executionTime: execTime, responseSize: respSize });

      // Track as recent resource (only for JSON where we can extract info)
      if (format === 'json') {
        const displayName = this.generateFavoriteDisplayName(result, query);
        const resourceType = this.extractResourceType(query);
        const resultType: 'single' | 'bundle' = (result as any).resourceType === 'Bundle' ? 'bundle' : 'single';
        this.recentResourcesService.addRecentResource(query, displayName, resultType, resourceType);
      }

    } catch (err: any) {
      this.logger.error('Query execution failed:', err || query);
      this.toastService.error(err.message || 'Query execution failed', 'Query Error');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Toggle between JSON and XML display format
   * Re-executes the current query with the new format
   */
  async toggleDisplayFormat() {
    const newFormat = this.displayFormat() === 'json' ? 'xml' : 'json';
    this.displayFormat.set(newFormat);

    // Re-execute the query with the new format
    const query = this.lastExecutedQuery();

    if (query) {
      await this.executeQueryString(query);
    }
  }

  /**
   * Navigate to a pagination page using the Bundle link URL
   * @param url Full URL from the Bundle link array
   */
  async navigateToPage(url: string) {
    this.loading.set(true);
    this.error.set(null);

    try {
      const startTime = performance.now();

      // executeQuery already handles full URLs (checks if starts with 'http')
      let result = await this.fhirService.executeQuery(url);

      if (result && typeof result === 'object' && 'subscribe' in result) {
        result = await firstValueFrom(result as any);
      }

      const endTime = performance.now();
      const execTime = Math.round(endTime - startTime);

      // Calculate response size from JSON string
      const responseStr = JSON.stringify(result);
      const respSize = new Blob([responseStr]).size;

      this.result.set(result);
      this.executionTime.set(execTime);
      this.responseSize.set(respSize);
      this.queryStateService.setResult(result, execTime, respSize);
      this.logger.info('Navigated to page:', url);
    } catch (err: any) {
      this.logger.error('Page navigation failed:', err);
      this.toastService.error(err.message || 'Page navigation failed', 'Navigation Error');
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

    const storageKeys = [
      'visual-builder-parameters',
      'visual-builder-includes',
      'visual-builder-revincludes',
      'visual-builder-count',
      'visual-builder-sort',
      'visual-builder-summary'
    ];

    storageKeys.forEach(key => localStorage.removeItem(key));
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
   * Handles search input with debouncing
   * @param event The input event
   */
  onSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;

    this.searchTermSubject.next(term);
  }

  /**
   * Recursively filters JSON object based on search term
   * Uses memoization to avoid redundant processing
   * @param obj The JSON object to filter
   * @param term The search term to filter by
   * @returns Filtered JSON object containing only matching keys/values
   */
  private filterJSON(obj: any, term: string): any {
    if (!term) {
      return obj;
    }

    // Create cache key based on object identity and search term
    const cacheKey = `${JSON.stringify(obj).substring(0, 100)}_${term}`;

    if (this.filterCache.has(cacheKey)) {
      return this.filterCache.get(cacheKey);
    }

    const result = this.performFilter(obj, term);

    // Limit cache size to 10 entries
    if (this.filterCache.size > 10) {
      const firstKey = this.filterCache.keys().next().value;

      if (firstKey) {
        this.filterCache.delete(firstKey);
      }
    }

    this.filterCache.set(cacheKey, result);

    return result;
  }

  /**
   * Performs the actual JSON filtering
   * @param obj The JSON object to filter
   * @param term The search term to filter by
   * @returns Filtered JSON object
   */
  private performFilter(obj: any, term: string): any {
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

  // ========================================
  // Autocomplete Methods
  // ========================================

  /**
   * Updates autocomplete suggestions based on current query and cursor position
   */
  updateAutocompleteSuggestions(): void {
    const input = this.textQueryInput?.nativeElement;
    const cursorPosition = input?.selectionStart ?? this.textQuery().length;

    const parsed = this.autocompleteService.parseQuery(this.textQuery(), cursorPosition);
    const suggestions = this.autocompleteService.getSuggestions(parsed);

    this.autocompleteSuggestions.set(suggestions);
    this.autocompleteSelectedIndex.set(-1);
    this.showAutocomplete.set(suggestions.length > 0);
  }

  /**
   * Handles text query input changes
   */
  onTextQueryInput(): void {
    this.updateAutocompleteSuggestions();
  }

  /**
   * Handles click in text query input (cursor position may change)
   */
  onTextQueryClick(): void {
    this.updateAutocompleteSuggestions();
  }

  /**
   * Handles focus on text query input
   */
  onTextQueryFocus(): void {
    this.updateAutocompleteSuggestions();
  }

  /**
   * Handles blur from text query input
   */
  onTextQueryBlur(): void {
    // Delay to allow click on suggestion
    setTimeout(() => {
      this.showAutocomplete.set(false);
    }, 150);
  }

  /**
   * Handles keyboard events for autocomplete navigation
   */
  onTextQueryKeyDown(event: KeyboardEvent): void {
    const suggestions = this.autocompleteSuggestions();
    const currentIndex = this.autocompleteSelectedIndex();
    const hasVisibleSuggestions = this.showAutocomplete() && suggestions.length > 0;

    switch (event.key) {
      case 'ArrowDown':
        if (hasVisibleSuggestions) {
          event.preventDefault();
          this.autocompleteSelectedIndex.set(
            Math.min(currentIndex + 1, suggestions.length - 1)
          );
        }
        break;

      case 'ArrowUp':
        if (hasVisibleSuggestions) {
          event.preventDefault();
          this.autocompleteSelectedIndex.set(Math.max(currentIndex - 1, -1));
        }
        break;

      case 'Tab':
        if (hasVisibleSuggestions) {
          event.preventDefault();
          const idx = currentIndex >= 0 ? currentIndex : 0;
          this.selectAutocompleteSuggestion(suggestions[idx]);
        }
        break;

      case 'Enter':
        // If a suggestion is selected, use it; otherwise execute the query
        if (hasVisibleSuggestions && currentIndex >= 0) {
          event.preventDefault();
          this.selectAutocompleteSuggestion(suggestions[currentIndex]);
        } else {
          // Execute the query
          this.showAutocomplete.set(false);
          this.executeTextQuery();
        }
        break;

      case 'Escape':
        if (hasVisibleSuggestions) {
          this.showAutocomplete.set(false);
          this.autocompleteSelectedIndex.set(-1);
        }
        break;
    }
  }

  /**
   * Selects an autocomplete suggestion
   */
  selectAutocompleteSuggestion(suggestion: Suggestion): void {
    const input = this.textQueryInput?.nativeElement;
    const cursorPosition = input?.selectionStart ?? this.textQuery().length;

    const result = this.autocompleteService.applySuggestion(
      this.textQuery(),
      cursorPosition,
      suggestion
    );

    this.textQuery.set(result.newQuery);
    this.showAutocomplete.set(false);
    this.autocompleteSelectedIndex.set(-1);

    // Set cursor position and trigger new suggestions
    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
        this.updateAutocompleteSuggestions();
      }
    }, 0);
  }

  /**
   * Gets icon class for autocomplete suggestion category
   */
  getAutocompleteCategoryIcon(category: string): string {
    switch (category) {
      case 'resource':
        return 'fa-cube';
      case 'parameter':
        return 'fa-filter';
      case 'global':
        return 'fa-globe';
      case 'modifier':
        return 'fa-at';
      case 'operator':
        return 'fa-equals';
      case 'value':
        return 'fa-tag';
      default:
        return 'fa-circle';
    }
  }

  /**
   * Gets color class for autocomplete suggestion category
   */
  getAutocompleteCategoryClass(category: string): string {
    switch (category) {
      case 'resource':
        return 'text-primary';
      case 'parameter':
        return 'text-success';
      case 'global':
        return 'text-info';
      case 'modifier':
        return 'text-warning';
      case 'operator':
        return 'text-danger';
      case 'value':
        return 'text-secondary';
      default:
        return 'text-muted';
    }
  }

  /**
   * Handles link clicks in Monaco editor
   * - If URL starts with FHIR server URL: strips base and executes as query
   * - If URL contains "StructureDefinition": creates StructureDefinition lookup query
   * - If URL starts with http://hl7.org/fhir: creates CodeSystem lookup query
   * - If URL starts with https://zibs.nl/wiki: opens in browser
   */
  onLinkClicked(url: string): void {
    this.logger.debug('Link clicked:', url);

    const serverUrl = this.fhirService.getServerUrl();

    if (url.startsWith(serverUrl)) {

      const relativePath = url.substring(serverUrl.length);

      this.textQuery.set(relativePath);
      this.queryMode.set('text');

      this.executeTextQuery();

    } else if (url.includes('StructureDefinition')) {

      const query = `/administration/StructureDefinition?url=${url}`;

      this.textQuery.set(query);
      this.queryMode.set('text');

      this.executeTextQuery();

    } else if (url.startsWith('http://hl7.org/fhir')) {

      // HL7 FHIR canonical URL - assume CodeSystem
      const query = `/administration/CodeSystem?url=${url}`;

      this.textQuery.set(query);
      this.queryMode.set('text');

      this.executeTextQuery();

    } else if (url.startsWith('https://zibs.nl/wiki')) {

      // Zibs wiki URL - open in external browser (decode URL-encoded characters)
      const decodedUrl = decodeURIComponent(url);
      this.logger.debug('Opening zibs URL in external browser:', decodedUrl);

      window.electronAPI?.shell?.openExternal(decodedUrl)
        .catch((err) => {
          this.logger.error('Failed to open URL in browser:', err);
        });

    } else {
      this.logger.info('URL does not match known patterns, ignoring:', url);
    }
  }

  /**
   * Handles coding click from Monaco editor
   * Navigates to terminology tab and triggers a $lookup operation
   */
  onCodingClicked(coding: { system: string; code: string; display?: string }): void {

    // Navigate to terminology tab via the navigation service
    this.navigationService.navigateToTerminologyLookup(coding);

    // Navigate to the terminology tab
    this.router.navigate(['/app/terminology']);
  }

  /**
   * Handles edit button click for single resources
   * Navigates to Nictiz tab and opens resource editor with the resource
   */
  onEditClicked(): void {

    const res = this.result();

    if (res?.resourceType) {
      this.navigationService.openResourceEditor(res);
    }
  }

  /**
   * Handles delete button click for single resources
   * Shows a confirmation dialog and deletes the resource if confirmed
   * After successful deletion, navigates to the resource type level query
   */
  async onDeleteClicked(): Promise<void> {
    const res = this.result();

    if (!res?.resourceType || !res?.id) {
      return;
    }

    const resourceType = res.resourceType;
    const resourceId = res.id;

    const confirmed = confirm(
      `Are you sure you want to delete this ${resourceType}/${resourceId}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    this.loading.set(true);

    try {
      await firstValueFrom(this.fhirService.delete(resourceType, resourceId));

      this.toastService.success(
        `${resourceType}/${resourceId} has been deleted successfully`,
        'Resource Deleted'
      );

      // Navigate to resource type level query
      this.textQuery.set(`/${resourceType}`);
      this.queryMode.set('text');
      await this.executeTextQuery();

    } catch (err: any) {
      this.logger.error('Delete failed:', err);
      this.toastService.error(err.message || 'Failed to delete resource', 'Delete Error');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Opens the resource diff dialog
   * If a single resource is loaded, it will be pre-filled as the left side
   */
  openDiffDialog(): void {
    const res = this.result();
    const options: { leftResource?: any; reference?: string } = {};

    // If we have a single resource (not a Bundle), pre-fill it
    if (res?.resourceType && res.resourceType !== 'Bundle' && res.id) {
      options.leftResource = res;
      options.reference = `/${res.resourceType}/${res.id}`;
    }

    this.diffDialog?.open(options);
  }

  /**
   * Opens the request inspector dialog
   * Shows HTTP request/response details for debugging
   */
  openInspectorDialog(): void {
    this.inspectorDialog?.open();
  }

  /**
   * Opens the query analytics dialog
   * Shows performance analytics for query history
   */
  openAnalyticsDialog(): void {
    this.analyticsDialog?.open();
  }

  /**
   * Copies the last executed query as a cURL command
   * Uses redacted auth tokens by default
   */
  async onCopyAsCurlClicked(): Promise<void> {
    const query = this.lastExecutedQuery();

    if (!query) {
      this.toastService.warning('No query to copy', 'Copy as cURL');

      return;
    }

    try {
      const curlCommand = await this.fhirService.generateCurl(query);
      await navigator.clipboard.writeText(curlCommand);
      this.toastService.success('cURL command copied to clipboard', 'Copy as cURL');
      this.logger.info('cURL command copied to clipboard');
    } catch (err) {
      this.logger.error('Failed to copy cURL command:', err);
      this.toastService.error('Failed to copy cURL command', 'Copy as cURL');
    }
  }

  /**
   * Executes the $everything operation for the current Patient or Encounter
   * Fetches all resources related to the compartment
   */
  async onEverythingClicked(): Promise<void> {
    const res = this.result();

    if (!res?.resourceType || !res?.id) {
      return;
    }

    const query = `/${res.resourceType}/${res.id}/$everything`;
    this.textQuery.set(query);
    this.queryMode.set('text');
    await this.executeTextQuery();
  }

  /**
   * Handles favorite toggle button click
   * Adds or removes the current query from favorites
   */
  onFavoriteToggled(): void {
    const query = this.getCurrentQuery();
    const res = this.result();

    if (!query || !res) {
      return;
    }

    const displayName = this.generateFavoriteDisplayName(res, query);
    const resourceType = this.extractResourceType(query);
    const resultType: 'single' | 'bundle' = res.resourceType === 'Bundle' ? 'bundle' : 'single';

    const wasAdded = this.favoritesService.toggleFavorite(query, displayName, resultType, resourceType);

    if (wasAdded) {
      this.toastService.success('Added to favorites', 'Favorites');
    } else {
      this.toastService.info('Removed from favorites', 'Favorites');
    }
  }

  /**
   * Gets the current query string based on query mode
   */
  private getCurrentQuery(): string | null {
    if (this.queryMode() === 'text') {
      return this.textQuery() || null;
    } else {
      return this.generatedQuery() || null;
    }
  }

  /**
   * Generates a user-friendly display name for a favorite
   * For single resources: extracts Patient name, title, code.text, etc.
   * For searches: uses query summary (e.g., "Patient search: name=Smith")
   */
  private generateFavoriteDisplayName(result: any, query: string): string {
    // For single resources, try to extract a meaningful name
    if (result.resourceType && result.resourceType !== 'Bundle') {
      // Try common FHIR name patterns
      if (result.name) {
        // Patient, Practitioner, Organization names
        if (Array.isArray(result.name)) {
          const name = result.name[0];

          if (name?.family || name?.given) {
            const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';

            return `${result.resourceType}: ${given} ${name.family || ''}`.trim();
          }

          if (typeof name === 'string') {
            return `${result.resourceType}: ${name}`;
          }
        } else if (typeof result.name === 'string') {
          return `${result.resourceType}: ${result.name}`;
        }
      }

      // Try title (for documents, questionnaires, etc.)
      if (result.title) {
        return `${result.resourceType}: ${result.title}`;
      }

      // Try code.text or code.coding[0].display
      if (result.code?.text) {
        return `${result.resourceType}: ${result.code.text}`;
      }

      if (result.code?.coding?.[0]?.display) {
        return `${result.resourceType}: ${result.code.coding[0].display}`;
      }

      // Fallback to resourceType/id
      if (result.id) {
        return `${result.resourceType}/${result.id}`;
      }

      return result.resourceType;
    }

    // For Bundle/search results, generate a summary from the query
    const resourceType = this.extractResourceType(query);
    const params = this.extractQueryParams(query);

    if (params.length > 0) {
      const summary = params.slice(0, 2).join(', ');

      return `${resourceType} search: ${summary}`;
    }

    return `${resourceType} search`;
  }

  /**
   * Extracts the resource type from a query string
   */
  private extractResourceType(query: string): string {
    // Remove leading slash and get the first path segment
    const cleanQuery = query.startsWith('/') ? query.substring(1) : query;
    const segments = cleanQuery.split(/[/?]/);

    return segments[0] || 'Unknown';
  }

  /**
   * Parse XML Bundle to extract pagination info (links and total)
   * Uses browser's DOMParser to parse the XML
   */
  private parseXmlBundleInfo(xml: string): any {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');

      // Check for parse errors
      const parseError = doc.querySelector('parsererror');

      if (parseError) {
        this.logger.warn('XML parse error:', parseError.textContent);

        return { resourceType: 'XMLResponse' };
      }

      // Get root element
      const root = doc.documentElement;
      const resourceType = root.localName || root.tagName;

      // If not a Bundle, return simple info
      if (resourceType !== 'Bundle') {
        return { resourceType, id: root.querySelector('id')?.getAttribute('value') };
      }

      // Extract total
      const totalElement = root.querySelector('total');
      const total = totalElement ? parseInt(totalElement.getAttribute('value') || '0', 10) : undefined;

      // Extract links for pagination
      const linkElements = root.querySelectorAll('link');
      const links: { relation: string; url: string }[] = [];

      linkElements.forEach(linkEl => {
        const relation = linkEl.querySelector('relation')?.getAttribute('value');
        const url = linkEl.querySelector('url')?.getAttribute('value');

        if (relation && url) {
          links.push({ relation, url });
        }
      });

      return {
        resourceType: 'Bundle',
        total,
        link: links.length > 0 ? links : undefined
      };
    } catch (err) {
      this.logger.error('Failed to parse XML Bundle info:', err);

      return { resourceType: 'XMLResponse' };
    }
  }

  /**
   * Extracts query parameters as key=value pairs
   */
  private extractQueryParams(query: string): string[] {
    const queryIndex = query.indexOf('?');

    if (queryIndex === -1) {
      return [];
    }

    const queryString = query.substring(queryIndex + 1);

    return queryString.split('&').map(param => {
      const [key, value] = param.split('=');
      // Decode and truncate long values
      const decodedValue = decodeURIComponent(value || '');
      const truncatedValue = decodedValue.length > 20 ? decodedValue.substring(0, 20) + '...' : decodedValue;

      return `${key}=${truncatedValue}`;
    });
  }
}
