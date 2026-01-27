# FHIR Client MX - Feature Suggestions

> Generated: 2026-01-25
> Last Updated: 2026-01-27 (Favorite Resources implemented)
> Status: Roadmap for future development

## Current Feature Summary

The application already includes:
- Query builder (text + visual modes) with autocomplete
- Terminology operations ($lookup, $expand, $validate-code, $translate)
- FHIR validation (client + server-side, R4 + STU3)
- OAuth2 + 2FA + mTLS authentication
- Profile browser with disk caching
- Subscriptions management (CRUD + monitoring)
- FHIRPath expression evaluator
- Predefined query templates
- Narratives with Handlebars templating
- Nictiz/Dutch healthcare integration
- **Interactive Reference Graph** (visualize resource relationships)
- **Resource Diff Viewer** (compare resources and history versions)

---

## Priority 1: Quick Wins (Low Effort, High Value)

### 1.1 $everything Operation ✅ IMPLEMENTED
**Effort:** Low | **Impact:** High

Add support for compartment-based $everything operations:
- `GET /Patient/123/$everything`
- `GET /Encounter/456/$everything`

**Status:** Fully implemented.

**Features delivered:**
- Toolbar button (asterisk icon) appears when viewing Patient or Encounter
- Clicking executes `$everything` operation for the resource
- Results displayed with standard Bundle pagination
- Autocomplete support for `$everything` in query input
- Query validator updated to support `$operation` syntax

---

### 1.2 Resource Version History ✅ IMPLEMENTED
**Effort:** Low | **Impact:** High

View historical versions of any resource:
- `GET /Patient/123/_history`
- `GET /Patient/123/_history/2`

**Status:** Implemented as part of the Resource Diff Viewer feature. The diff dialog includes a "Compare History" mode that fetches resource history and allows comparing any two versions.

**Implementation:**
- Added `FhirService.history()` method for fetching resource history
- History loaded in Resource Diff Dialog with version selector
- Display version list with timestamps
- Compare any two historical versions side-by-side

---

### 1.3 Copy as cURL ✅ IMPLEMENTED
**Effort:** Low | **Impact:** Medium

Export any executed query as a cURL command for sharing/debugging.

**Status:** Fully implemented.

**Features delivered:**
- Toolbar button with terminal icon appears after query execution
- Generates complete cURL command with headers
- Auth tokens are redacted by default for security
- Supports GET queries (POST/PUT/DELETE via direct FhirService usage)
- Copies to clipboard with toast notification
- Added `FhirService.generateCurl()` method

---

### 1.4 Request/Response Inspector ✅ IMPLEMENTED
**Effort:** Low | **Impact:** Medium

Show raw HTTP details for debugging:
- Request headers sent
- Response headers received
- Status code and timing
- Response size

**Status:** Fully implemented.

**Features delivered:**
- Clickable timing badge opens inspector dialog
- Tabbed interface: Request / Response / Timing
- Request tab shows all headers and body (if any)
- Response tab shows all response headers
- Timing tab with visual stats cards (request size, response size, duration, status)
- Color-coded HTTP method badges (GET=green, POST=blue, PUT=yellow, DELETE=red)
- Color-coded status badges based on HTTP status code
- HTTP interceptor captures all traffic automatically

---

### 1.5 Query Execution Time ✅ IMPLEMENTED
**Effort:** Low | **Impact:** Medium

Display query performance metrics:
- Total execution time (ms)
- Network time vs processing time
- Response size

**Status:** Fully implemented.

**Features delivered:**
- Timing badge in result header with clock icon
- Color-coded performance indicator (green <500ms, yellow <2s, red >=2s)
- Response size displayed in human-readable format (B/KB/MB)
- Metrics stored in query history for comparison
- Works for both text mode and visual query builder
- Pagination navigation also tracks timing

---

### 1.6 Favorite Resources ✅ IMPLEMENTED
**Effort:** Low | **Impact:** Medium

Bookmark frequently accessed resources:
- Star button on single resources
- Favorites list in sidebar or dropdown
- Quick navigation to bookmarked resources

**Status:** Fully implemented.

**Features delivered:**
- Star button in result toolbar for any query with results
- Gold star indicates favorited, outline star for not favorited
- Smart display name generation (extracts patient names, titles, codes for single resources; query summary for searches)
- Collapsible favorites section in sidebar with badge count
- Different icons: file icon for single resources, folder icon for bundle/search results
- Click favorite to navigate and re-execute query instantly
- Remove button on hover for each favorite
- Favorites filtered by active server profile (multi-server support)
- Persisted in localStorage with `fhir_favorite_resources` key
- Toast notifications when adding/removing favorites

---

### 1.7 Recent Resources
**Effort:** Low | **Impact:** Medium

Track recently viewed resources:
- Last 20-50 viewed resources
- Persisted in electron-store
- Quick access dropdown

---

### 1.8 XML Format Toggle
**Effort:** Medium | **Impact:** Medium

Switch between JSON and XML display:
- Toggle button in toolbar
- Request with `_format=xml` or Accept header
- Syntax highlighting for XML

---

## Priority 2: Core FHIR Operations

### 2.1 Batch/Transaction Bundle Support
**Effort:** Medium | **Impact:** High

Execute FHIR Bundles with multiple operations:

```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    { "request": { "method": "POST", "url": "Patient" }, "resource": {...} },
    { "request": { "method": "PUT", "url": "Observation/123" }, "resource": {...} }
  ]
}
```

**Features:**
- Visual bundle builder UI
- Import bundle from file
- Execute and show per-entry results
- Rollback indication for failed transactions
- Template bundles for common workflows

---

### 2.2 Bulk Import
**Effort:** Medium | **Impact:** High

Import multiple resources from files:
- JSON array of resources
- NDJSON (newline-delimited JSON) format
- Drag-and-drop file support
- Progress indicator for large imports
- Error reporting per resource
- Dry-run validation option

---

### 2.3 Bulk Export
**Effort:** Medium | **Impact:** High

Export query results in multiple formats:
- JSON (current)
- NDJSON for bulk data
- CSV (flattened)
- Excel (.xlsx)
- Select specific fields for export

**Implementation:**
- Add export dropdown in result header
- Field selector dialog for CSV/Excel
- Use libraries: `xlsx`, `json2csv`

---

### 2.4 GraphQL Support
**Effort:** Medium | **Impact:** Medium

FHIR GraphQL queries as alternative to REST:

```graphql
{
  Patient(id: "123") {
    name { given family }
    birthDate
    generalPractitioner {
      resource { ... on Practitioner { name { text } } }
    }
  }
}
```

**Implementation:**
- New tab or mode in query builder
- GraphQL editor with syntax highlighting
- Schema introspection from server

---

### 2.5 $validate with Profile Selection ✅ IMPLEMENTED
**Effort:** Low | **Impact:** Medium

Enhanced validation with explicit profile selection:
- `POST /Patient/$validate?profile=http://...`
- Dropdown to select from known profiles
- Validate against multiple profiles

**Status:** Fully implemented.

**Features delivered:**
- Toggle for "Use Server $validate" in Validator tab
- Dropdown populated with StructureDefinitions from server
- Custom profile URL input option
- Refresh button to reload available profiles
- Server-side validation with OperationOutcome parsing
- Added `FhirService.validateOnServer()` and `FhirService.getProfiles()` methods

---

## Priority 3: Advanced Features

### 3.1 Resource Diff Viewer ✅ IMPLEMENTED
**Effort:** Medium | **Impact:** High

Compare two resources or versions side-by-side:
- Visual diff with highlighted changes
- Compare current vs historical version
- Compare two different resources
- Inline or side-by-side view modes

**Status:** Fully implemented with Monaco diff editor.

**Features delivered:**
- Full-screen dialog accessible from result toolbar (compare button)
- Two modes: "Compare History" and "Compare Resources"
- Auto-load history when opening from a single resource
- Fetch resources by reference or paste JSON directly
- Side-by-side and inline view modes
- Diff statistics (additions/deletions count)
- Swap left/right sides functionality

**Libraries used:** Monaco Editor diff view

---

### 3.2 Interactive Reference Graph ✅ IMPLEMENTED
**Effort:** High | **Impact:** High

Visualize resource references as interactive graph:
- Patient at center
- Connected Encounters, Observations, Conditions
- Click to navigate to resource
- Expand/collapse nodes
- Filter by resource type

**Status:** Fully implemented with vis-network.

**Features delivered:**
- Dedicated "Reference Graph" tab
- Start from any resource with configurable depth (1-5 levels)
- Forward references (resources that the target references)
- Reverse references (resources that reference the target)
- Double-click nodes to expand further
- Click nodes to view full resource JSON
- "Query" button to navigate to FHIR Query tab and auto-execute
- Visual differentiation: colors per resource type, dashed lines for reverse refs
- Root node highlighting with distinct border style
- Physics-based layout with drag support
- Fit-to-view and focus-on-selected controls

**Libraries used:** `vis-network` (vis.js)

---

### 3.3 Questionnaire Renderer
**Effort:** High | **Impact:** High

Render and fill FHIR Questionnaires:
- Parse Questionnaire resource
- Generate dynamic form UI
- Support all item types (string, choice, boolean, date, etc.)
- Conditional logic (enableWhen)
- Generate QuestionnaireResponse
- Validate responses

**Libraries:** Consider `lforms` or custom implementation

---

### 3.4 SMART on FHIR Launch
**Effort:** Medium | **Impact:** Medium

Support SMART app launch context:
- Standalone launch
- EHR launch simulation
- Launch context parameters (patient, encounter)
- Scope selection
- Token introspection

---

### 3.5 Webhook Listener
**Effort:** Medium | **Impact:** Medium

Built-in server to receive subscription notifications:
- Start local HTTP server on configurable port
- Display received notifications
- Log notification history
- Test subscription delivery

**Implementation:**
- Electron can run Express server
- Show notifications in Subscriptions tab
- ngrok integration for public URL (optional)

---

### 3.6 Offline Mode
**Effort:** High | **Impact:** Medium

Cache resources for offline viewing/editing:
- Mark resources for offline access
- Sync queue for pending changes
- Conflict resolution on reconnect
- Storage quota management

---

## Priority 4: Analytics & Visualization

### 4.1 Dashboard with Charts
**Effort:** High | **Impact:** Medium

Visualize query results:
- Count by resource type
- Timeline of resources by date
- Distribution charts (age, gender, etc.)
- Custom chart builder

**Libraries:** `chart.js`, `echarts`, `plotly`

---

### 4.2 Query Performance Analytics
**Effort:** Medium | **Impact:** Low

Track and analyze query performance:
- Historical execution times
- Slow query identification
- Server response time trends
- Suggestions for optimization

---

## Priority 5: Developer Experience

### 5.1 Code Generation
**Effort:** Medium | **Impact:** Medium

Generate boilerplate code from resources:
- TypeScript interfaces from StructureDefinition
- Sample resource JSON from profile
- API client code snippets

---

### 5.2 Postman/OpenAPI Export
**Effort:** Medium | **Impact:** Low

Export queries as:
- Postman collection
- OpenAPI/Swagger spec
- Insomnia collection

---

### 5.3 Test Data Generator
**Effort:** High | **Impact:** Medium

Generate realistic test data:
- Based on profiles/StructureDefinitions
- Configurable quantity
- Referential integrity between resources
- Synthea integration option

---

### 5.4 Plugin System
**Effort:** High | **Impact:** Medium

Extensibility architecture:
- Custom tabs/panels
- Custom operations
- Custom export formats
- Marketplace for community plugins

---

## Security Improvements (From Audit)

These should be addressed regardless of new features:

| Priority | Issue | File |
|----------|-------|------|
| Critical | Enable sandbox mode | `electron/main.js` |
| High | URL validation in shell.openExternal | `electron/main.js` |
| High | Move terminology credentials to secure storage | `electron/config/` |
| Medium | Remove CSP unsafe-inline | `electron/main.js` |
| Medium | Path traversal protection | `electron/services/narrative-templates.js` |
| Low | Hide DevTools in production | `electron/menu/menu-handler.js` |

---

## Implementation Notes

### Technology Suggestions

| Feature | Recommended Library |
|---------|---------------------|
| Diff viewer | Monaco Editor diff, `diff` |
| Graph visualization | `cytoscape.js`, `vis.js` |
| Charts | `chart.js`, `echarts` |
| Excel export | `xlsx`, `exceljs` |
| CSV export | `json2csv`, `papaparse` |
| Questionnaire | Custom or `lforms` |
| GraphQL | `graphql`, `graphiql` |

### Electron IPC Handlers Needed

```
// Batch operations
ipcMain.handle('fhir:executeBatch', ...)
ipcMain.handle('fhir:executeTransaction', ...)

// Bulk operations
ipcMain.handle('fhir:bulkImport', ...)
ipcMain.handle('fhir:bulkExport', ...)

// History ✅ Implemented via FhirService.history()
// ipcMain.handle('fhir:getHistory', ...) - Not needed, uses existing executeQuery

// Favorites ✅ Implemented via localStorage (FavoritesService)
// No IPC needed - uses localStorage with key 'fhir_favorite_resources'

// Webhook server
ipcMain.handle('webhook:start', ...)
ipcMain.handle('webhook:stop', ...)
ipcMain.handle('webhook:getNotifications', ...)
```

---

## Suggested Development Order

### Phase 1: Quick Wins (1-2 weeks)
1. ~~Query execution time display~~ ✅ Done
2. ~~Copy as cURL~~ ✅ Done
3. ~~$everything operation~~ ✅ Done
4. ~~Request/Response Inspector~~ ✅ Done
5. ~~Favorite Resources~~ ✅ Done
6. Recent resources list

### Phase 2: Core Operations (2-4 weeks)
1. ~~Resource version history with basic diff~~ ✅ Done (integrated in Diff Viewer)
2. Bulk export (CSV, Excel)
3. Batch/Transaction support
4. Bulk import

### Phase 3: Advanced Features (4-8 weeks) - PARTIALLY COMPLETE
1. ~~Interactive reference graph~~ ✅ Done
2. ~~Full diff viewer~~ ✅ Done
3. Questionnaire renderer
4. GraphQL support

### Phase 4: Polish (2-4 weeks)
1. Dashboard/charts
2. Webhook listener
3. SMART on FHIR launch
4. Security fixes

---

## Contributing

When implementing these features:
1. Follow existing code patterns (Angular signals, standalone components)
2. Add Electron IPC handlers in separate files under `electron/`
3. Expose APIs through `preload.js` with proper channel validation
4. Use Monaco Editor for code/JSON editing
5. Add appropriate error handling and logging
6. Update this document when features are completed

---

*Last updated: 2026-01-27*
