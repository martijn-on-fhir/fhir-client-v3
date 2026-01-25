# Performance Optimization Report

## Executive Summary

This report identifies performance optimization opportunities for the FHIR Client v3 Electron application, focusing on memory usage, bundle size, and rendering performance.

---

## 1. Bundle Size Optimization

### 1.1 Implement Lazy Loading for Routes

**Priority:** High
**Location:** `src/app/app.routes.ts`
**Estimated Savings:** 30-50% reduction in initial bundle size

**Problem:** All 12 feature components are eagerly loaded, increasing initial bundle size significantly.

```typescript
// Current: Direct imports
import { FhirpathComponent } from './features/fhirpath/fhirpath.component';
import { LogsComponent } from './features/logs/logs.component';
import { NarrativesComponent } from './features/narratives/narratives.component';
```

**Solution:** Convert to lazy-loaded routes:

```typescript
export const routes: Routes = [
  {
    path: 'app',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'profiles',
        loadComponent: () => import('./features/profiles/profiles.component')
          .then(m => m.ProfilesComponent)
      },
      {
        path: 'query',
        loadComponent: () => import('./features/query/query.component')
          .then(m => m.QueryComponent)
      },
      {
        path: 'validator',
        loadComponent: () => import('./features/validator/validator.component')
          .then(m => m.ValidatorComponent)
      },
      {
        path: 'terminology',
        loadComponent: () => import('./features/terminology/terminology.component')
          .then(m => m.TerminologyComponent)
      },
      {
        path: 'fhirpath',
        loadComponent: () => import('./features/fhirpath/fhirpath.component')
          .then(m => m.FhirpathComponent)
      },
      // Apply to all feature routes...
    ]
  }
];
```

---

### 1.2 Tree-Shake FontAwesome Icons

**Priority:** Medium
**Location:** `package.json`
**Estimated Savings:** ~1.4MB

**Problem:** The entire FontAwesome library (~1.5MB) is loaded via CSS.

**Solution:** Switch to Angular-specific package with individual icon imports:

```bash
npm install @fortawesome/angular-fontawesome @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons
```

```typescript
// In component
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFilter, faCube, faGlobe } from '@fortawesome/free-solid-svg-icons';

@Component({
  imports: [FontAwesomeModule],
  template: `<fa-icon [icon]="faFilter"></fa-icon>`
})
export class MyComponent {
  faFilter = faFilter;
}
```

---

### 1.3 Create Monaco Loader Service

**Priority:** Medium
**Location:** `src/app/shared/components/monaco-editor/`

**Problem:** Monaco editor (~2.5MB) initialization is duplicated across component instances.

**Solution:** Create a shared loader service:

```typescript
// monaco-loader.service.ts
import { Injectable } from '@angular/core';
import loader, { Monaco } from '@monaco-editor/loader';

@Injectable({ providedIn: 'root' })
export class MonacoLoaderService {
  private monacoPromise: Promise<Monaco> | null = null;

  loadMonaco(): Promise<Monaco> {
    if (!this.monacoPromise) {
      loader.config({ paths: { vs: 'assets/monaco/vs' } });
      this.monacoPromise = loader.init();
    }
    return this.monacoPromise;
  }
}
```

---

## 2. Memory Usage Optimization

### 2.1 Auto-Clear Large Query Results

**Priority:** High
**Location:** `src/app/core/services/query-state.service.ts:16-17`
**Estimated Savings:** 10-50MB per large query

**Problem:** The `resultSignal` stores complete FHIR Bundle objects indefinitely.

**Solution:** Add auto-expiry for large results:

```typescript
private resultSignal = signal<any>(null);
private resultExpiryTimeout: any = null;

setResult(result: any, executionTime?: number) {
  // Clear any pending expiry
  if (this.resultExpiryTimeout) {
    clearTimeout(this.resultExpiryTimeout);
  }

  this.resultSignal.set(result);
  this.resultTimestampSignal.set(new Date());

  if (executionTime !== undefined) {
    this.executionTimeSignal.set(executionTime);
  }

  // Auto-clear large results after 5 minutes of inactivity
  if (result?.entry?.length > 50) {
    this.resultExpiryTimeout = setTimeout(() => {
      this.clearResult();
    }, 5 * 60 * 1000);
  }
}

clearResult() {
  if (this.resultExpiryTimeout) {
    clearTimeout(this.resultExpiryTimeout);
    this.resultExpiryTimeout = null;
  }
  this.resultSignal.set(null);
  this.resultTimestampSignal.set(null);
  this.executionTimeSignal.set(null);
}
```

---

### 2.2 Batch localStorage Writes

**Priority:** High
**Location:** `src/app/features/query/query.component.ts:429-489`

**Problem:** 14+ separate `effect()` calls write to localStorage synchronously on every state change.

**Solution:** Debounce and batch all localStorage writes:

```typescript
import { debounceTime, Subject } from 'rxjs';

private saveStateSubject = new Subject<void>();
private destroyRef = inject(DestroyRef);

constructor() {
  // Single debounced save
  this.saveStateSubject.pipe(
    debounceTime(500),
    takeUntilDestroyed(this.destroyRef)
  ).subscribe(() => this.saveStateToStorage());

  // Consolidated effect to trigger saves
  effect(() => {
    // Access all signals to track them
    this.queryMode();
    this.textQuery();
    this.parameters();
    this.selectedIncludes();
    this.selectedRevIncludes();
    // ... other signals
    this.saveStateSubject.next();
  });
}

private saveStateToStorage(): void {
  const state = {
    queryMode: this.queryMode(),
    textQuery: this.textQuery(),
    parameters: this.parameters(),
    includes: this.selectedIncludes(),
    revIncludes: this.selectedRevIncludes(),
    // ... all other state
  };
  localStorage.setItem('fhir-query-builder-state', JSON.stringify(state));
}

private loadStateFromStorage(): void {
  const saved = localStorage.getItem('fhir-query-builder-state');
  if (saved) {
    const state = JSON.parse(saved);
    this.queryMode.set(state.queryMode ?? 'visual');
    this.textQuery.set(state.textQuery ?? '');
    // ... restore other state
  }
}
```

---

### 2.3 Fix Monaco Editor Memory Leak Risk

**Priority:** Low
**Location:** `src/app/shared/components/monaco-editor/monaco-editor.component.ts:134-148`

**Problem:** The `initInterval` polling loop can leak if component is destroyed during initialization.

**Solution:** Add a disposed flag:

```typescript
private isDisposed = false;

ngAfterViewInit() {
  if (this.monaco) {
    this.initMonaco();
  } else {
    let attempts = 0;
    this.initInterval = setInterval(() => {
      if (this.isDisposed) {
        clearInterval(this.initInterval);
        return;
      }
      attempts++;
      if (this.monaco) {
        clearInterval(this.initInterval);
        this.initMonaco();
      } else if (attempts > 100) {
        clearInterval(this.initInterval);
        console.error('Monaco failed to load after 10 seconds');
      }
    }, 100);
  }
}

ngOnDestroy() {
  this.isDisposed = true;
  if (this.initInterval) {
    clearInterval(this.initInterval);
  }
  this.editor?.dispose();
}
```

---

## 3. Rendering/UI Optimization

### 3.1 Enable OnPush Change Detection

**Priority:** High
**Location:** `src/app/features/query/query.component.ts`

**Problem:** `ngAfterViewChecked` runs on every change detection cycle, setting signals that trigger more cycles.

**Solution:** Use OnPush and ViewChild setters:

```typescript
@Component({
  selector: 'app-query',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
export class QueryComponent {
  // Replace ngAfterViewChecked with ViewChild setters
  @ViewChild('component')
  set componentRef(ref: MonacoEditorComponent | undefined) {
    if (ref?.editor && this.textModeEditor() !== ref.editor) {
      this.textModeEditor.set(ref.editor);
    }
  }

  @ViewChild('componentVisual')
  set componentVisualRef(ref: MonacoEditorComponent | undefined) {
    if (ref?.editor && this.visualModeEditor() !== ref.editor) {
      this.visualModeEditor.set(ref.editor);
    }
  }
}
```

---

### 3.2 Debounce and Memoize JSON Filtering

**Priority:** Medium
**Location:** `src/app/features/query/query.component.ts:1052-1091`

**Problem:** The `filterJSON` method recursively traverses entire JSON objects on every search keystroke.

**Solution:** Add debouncing and memoization:

```typescript
private filterCache = new Map<string, any>();
private filterSubject = new Subject<string>();

constructor() {
  this.filterSubject.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    takeUntilDestroyed(this.destroyRef)
  ).subscribe(term => {
    this.searchTerm.set(term);
  });
}

onSearchInput(event: Event): void {
  const term = (event.target as HTMLInputElement).value;
  this.filterSubject.next(term);
}

private filterJSON(obj: any, term: string): any {
  const cacheKey = `${JSON.stringify(obj).substring(0, 100)}_${term}`;

  if (this.filterCache.has(cacheKey)) {
    return this.filterCache.get(cacheKey);
  }

  const result = this.performFilter(obj, term);

  // Limit cache size to 10 entries
  if (this.filterCache.size > 10) {
    const firstKey = this.filterCache.keys().next().value;
    this.filterCache.delete(firstKey);
  }

  this.filterCache.set(cacheKey, result);
  return result;
}
```

---

### 3.3 Virtual Scrolling for Large Lists

**Priority:** Medium
**Location:** Query results and profiles list

**Problem:** Large lists cause slow rendering and high memory usage.

**Solution:** Use Angular CDK Virtual Scrolling:

```typescript
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport itemSize="50" class="results-viewport">
      <div *cdkVirtualFor="let entry of entries()" class="result-item">
        {{ entry.resource.resourceType }}/{{ entry.resource.id }}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: [`
    .results-viewport {
      height: 400px;
    }
    .result-item {
      height: 50px;
    }
  `]
})
```

---

## 4. Build Configuration

### 4.1 Add Bundle Analyzer

Add to `package.json`:

```json
{
  "scripts": {
    "analyze": "ng build --configuration production --source-map && npx source-map-explorer dist/fhir-client/browser/*.js"
  }
}
```

---

### 4.2 Tighten Performance Budgets

Update `angular.json`:

```json
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "500KB",
    "maximumError": "1MB"
  },
  {
    "type": "anyComponentStyle",
    "maximumWarning": "4KB",
    "maximumError": "8KB"
  }
]
```

---

## 5. Electron Main Process

### 5.1 Reduce Splash Screen Duration

**Priority:** Low
**Location:** `electron/main.js:186-198`

**Problem:** Splash screen shows for minimum 4 seconds even if app is ready sooner.

**Solution:** Reduce to 2 seconds:

```javascript
const remainingTime = Math.max(0, 2000 - elapsedTime);
```

---

## Implementation Priority

| # | Optimization | Impact | Risk | Effort |
|---|-------------|--------|------|--------|
| 1 | Lazy loading routes | High | Low | Low |
| 2 | Debounce localStorage writes | High | Low | Medium |
| 3 | OnPush change detection | High | Medium | Medium |
| 4 | Auto-clear query results | Medium | Low | Low |
| 5 | FontAwesome tree-shaking | Medium | Low | Medium |
| 6 | Debounce JSON filtering | Medium | Low | Low |
| 7 | Virtual scrolling | Medium | Medium | Medium |
| 8 | Monaco loader service | Low | Low | Low |

---

## Expected Results

| Metric | Current | Expected |
|--------|---------|----------|
| Initial bundle size | ~2MB | ~1MB |
| Memory (large queries) | 50-100MB | 20-40MB |
| Change detection cycles | Excessive | Minimal |
| localStorage writes | Per keystroke | Debounced (500ms) |

---

*Generated: January 2026*
