# Query History Navigation Implementation Plan

## 🎯 Objective
Implement query history navigation in the FHIR Query tab, matching the v2 implementation shown in the screenshot.

## 📸 Current v2 Screenshot Analysis
The v2 interface shows:
- Two navigation buttons (< and >) at the left of the query input row
- Text Mode / Visual Builder toggle buttons
- Query input field with the current query
- Execute button (with lightning bolt icon) on the right
- Info button (?) next to Execute

## 📋 Implementation Tasks

### 1. **Query History Service**
**File**: `src/app/core/services/query-history.service.ts`

Create a service to manage query history:
- Store executed queries in an array
- Track current position in history
- Provide methods for:
  - `addQuery(query: string)` - Add query to history
  - `navigateBack()` - Go to previous query
  - `navigateForward()` - Go to next query
  - `getCurrentQuery()` - Get current query
  - `canNavigateBack()` - Check if back navigation possible
  - `canNavigateForward()` - Check if forward navigation possible
  - `clearHistory()` - Clear all history
  - `getHistory()` - Get full history array

**Data Structure**:
```typescript
interface QueryHistoryState {
  queries: string[];        // Array of executed queries
  currentIndex: number;     // Current position in history (-1 = no history)
  maxSize: number;          // Maximum history size (default: 50)
}
```

**Persistence**:
- Save history to localStorage with key: `fhir_query_history`
- Load history on service initialization
- Auto-save when history changes

---

### 2. **Update Query Component TypeScript**
**File**: `src/app/features/query/query.component.ts`

**Add**:
- Inject `QueryHistoryService`
- Signals for navigation state:
  - `canGoBack = computed(() => historyService.canNavigateBack())`
  - `canGoForward = computed(() => historyService.canNavigateForward())`

**Methods**:
- `navigateBack()`: Load previous query from history
- `navigateForward()`: Load next query from history
- Update `executeTextQuery()` to add query to history after successful execution

**Behavior**:
- When navigating back/forward, update the `textQuery` signal
- Don't add to history when navigating (only when executing)
- Show visual feedback when navigation buttons are disabled

---

### 3. **Update Query Component Template**
**File**: `src/app/features/query/query.component.html`

**Changes to Text Mode section**:

```html
<!-- Text Mode -->
@if (queryMode() === 'text') {
  <div class="flex-grow-1 d-flex flex-column" style="gap: 8px">
    <!-- Query Input with History Navigation -->
    <div class="card border-0">
      <div class="card-body p-2">
        <div class="d-flex gap-2 align-items-center">

          <!-- History Navigation Buttons -->
          <button
            class="btn btn-sm btn-outline-secondary"
            (click)="navigateBack()"
            [disabled]="!canGoBack()"
            title="Previous query">
            <i class="fas fa-chevron-left"></i>
          </button>

          <button
            class="btn btn-sm btn-outline-secondary"
            (click)="navigateForward()"
            [disabled]="!canGoForward()"
            title="Next query">
            <i class="fas fa-chevron-right"></i>
          </button>

          <!-- Mode Toggle Buttons -->
          <button
            class="btn btn-sm"
            [class.btn-primary]="queryMode() === 'text'"
            [class.btn-outline-secondary]="queryMode() !== 'text'"
            (click)="setQueryMode('text')">
            <i class="fas fa-edit me-1"></i>Text Mode
          </button>

          <button
            class="btn btn-sm"
            [class.btn-primary]="queryMode() === 'visual'"
            [class.btn-outline-secondary]="queryMode() !== 'visual'"
            (click)="setQueryMode('visual')">
            <i class="fas fa-wand-magic-sparkles me-1"></i>Visual Builder
          </button>

          <!-- Query Input (flex-grow to take remaining space) -->
          <input
            id="textQuery"
            type="text"
            class="form-control"
            style="flex: 1"
            [ngModel]="textQuery()"
            (ngModelChange)="textQuery.set($event)"
            (keydown.enter)="executeTextQuery()"
            placeholder="/Patient?name=John"
            spellCheck="false">

          <!-- Execute Button -->
          <button
            class="btn btn-sm btn-primary"
            (click)="executeTextQuery()"
            [disabled]="!textQuery() || loading()">
            <i class="fas fa-bolt me-1"></i>
            Execute
          </button>

          <!-- Info Button -->
          <button
            class="btn btn-sm btn-outline-secondary"
            title="Query help">
            <i class="fas fa-circle-info"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Rest of the template... -->
  </div>
}
```

---

### 4. **Styling Updates**
**File**: `src/app/features/query/query.component.scss`

Add styles for:
- History navigation buttons (consistent with other buttons)
- Disabled state styling
- Button hover effects
- Proper spacing between elements

```scss
.query-container {
  // History navigation buttons
  .btn-outline-secondary {
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  // Compact button row
  .d-flex.gap-2 {
    .btn-sm {
      white-space: nowrap;
    }
  }
}
```

---

### 5. **Visual Mode Integration** (Optional for later)
When in Visual Builder mode, the history could also track visual builder configurations.

**Considerations**:
- Store visual builder state alongside text queries
- When navigating, restore both text query and builder state
- Could use a `QueryHistoryEntry` interface:
  ```typescript
  interface QueryHistoryEntry {
    textQuery: string;
    mode: 'text' | 'visual';
    visualBuilderState?: VisualBuilderState;
    timestamp: number;
  }
  ```

---

## 🎨 UI/UX Considerations

1. **Button Icons**:
   - Back: `fa-chevron-left` or `fa-arrow-left`
   - Forward: `fa-chevron-right` or `fa-arrow-right`

2. **Button States**:
   - Disabled when no history available
   - Visual feedback on hover
   - Tooltips for clarity

3. **Layout**:
   - All elements in a single horizontal row
   - History buttons at the start (left)
   - Mode toggle buttons next
   - Query input takes remaining space (flex: 1)
   - Execute button at the end
   - Optional info button after Execute

4. **Keyboard Shortcuts** (Future enhancement):
   - `Alt+Left`: Navigate back
   - `Alt+Right`: Navigate forward
   - `Ctrl+Enter`: Execute query

---

## 🧪 Testing Checklist

- [ ] History service stores queries correctly
- [ ] Navigation buttons enable/disable appropriately
- [ ] Back navigation loads previous query
- [ ] Forward navigation loads next query
- [ ] History persists across app restarts (localStorage)
- [ ] Maximum history size is respected
- [ ] Executing a new query adds to history
- [ ] Navigating doesn't add duplicate entries
- [ ] History works in both text and visual modes
- [ ] Layout matches v2 screenshot

---

## 📝 Implementation Order

1. **Phase 1**: Query History Service (30 min)
   - Create service with basic methods
   - Add localStorage persistence
   - Unit test the service

2. **Phase 2**: Update Query Component Logic (20 min)
   - Inject service
   - Add navigation methods
   - Update execute method to add to history

3. **Phase 3**: Update Template (30 min)
   - Restructure query input row
   - Add navigation buttons
   - Reposition mode toggle buttons
   - Update Execute button styling

4. **Phase 4**: Styling & Polish (20 min)
   - Add SCSS for new layout
   - Ensure responsive behavior
   - Test in both light and dark modes

5. **Phase 5**: Testing & Refinement (20 min)
   - Manual testing of all scenarios
   - Fix any edge cases
   - Verify localStorage persistence

**Total Estimated Time**: ~2 hours

---

## 🚀 Future Enhancements

- Search through query history
- Star/favorite queries
- Export/import query history
- Query history management dialog
- Statistics (most used queries, etc.)
- Keyboard shortcut support
- Visual builder state in history

