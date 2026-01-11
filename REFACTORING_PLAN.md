# Result Header Refactoring Plan

## Branch
`refactor/shared-result-header`

## Doel
Maak een herbruikbare `ResultHeaderComponent` om code duplicatie te verminderen tussen de verschillende tab result headers.

## Huidige Situatie

**Componenten met result headers (7):**
1. Validator - `fa-check-circle`, "Fhir Validator", editable
2. FhirPath - `fa-sitemap`, "FhirPath Tester", read-only
3. Pluriform - `fa-shapes`, "XML Transformation", editable (left editor)
4. Query (2x) - `fa-file-lines`, "Result", read-only (text + visual mode)
5. Predefined - `fa-file-lines`, "Result", read-only, conditional toolbar
6. Terminology - `fa-chart-bar`, "Results", read-only, extra wrapper
7. Logs - `fa-list`, "Application Logs", NO toolbar, live badge

**Gemeenschappelijke elementen:**
- `class="card-header d-flex justify-content-between align-items-center"`
- Icon + Title in `<span>`
- `app-json-viewer-toolbar` (behalve Logs)

**Variabelen:**
- Icon class
- Title text
- Editor reference voor toolbar
- ReadOnly state voor toolbar
- Extra content (badges, conditional logic)
- Style properties (flex-shrink, padding)

## Ontwerp: ResultHeaderComponent

### Component API

```typescript
@Component({
  selector: 'app-result-header',
  standalone: true,
  imports: [CommonModule, JsonViewerToolbarComponent],
  templateUrl: './result-header.component.html',
  styleUrls: ['./result-header.component.scss']
})
export class ResultHeaderComponent {
  // Required inputs
  @Input() icon!: string;              // FontAwesome icon class (e.g., 'fa-check-circle')
  @Input() title!: string;             // Header title

  // Toolbar inputs (optional)
  @Input() showToolbar = true;         // Show/hide toolbar
  @Input() editor?: any;               // Monaco editor instance
  @Input() readOnly = true;            // Editor read-only state

  // Styling inputs (optional)
  @Input() flexShrink = true;          // Add style="flex-shrink: 0"
  @Input() padding: 'default' | 'small' = 'default';  // Padding size

  // Content projection
  // Voor extra content zoals badges, conditional elements
}
```

### Template

```html
<div
  class="card-header d-flex justify-content-between align-items-center"
  [class.p-2]="padding === 'small'"
  [style.flex-shrink]="flexShrink ? 0 : null">

  <span>
    <i class="fas {{ icon }} me-2"></i>
    {{ title }}

    <!-- Content projection voor extra badges/content na title -->
    <ng-content select="[slot='title-suffix']"></ng-content>
  </span>

  <div class="d-flex gap-2 align-items-center">
    <!-- Content projection voor extra buttons/controls -->
    <ng-content select="[slot='actions']"></ng-content>

    <!-- Toolbar -->
    @if (showToolbar && editor) {
      <app-json-viewer-toolbar
        [editor]="editor"
        [readOnly]="readOnly">
      </app-json-viewer-toolbar>
    }
  </div>
</div>
```

## Implementatie Stappen

### Fase 1: Component Creatie
- [ ] Maak `src/app/shared/components/result-header/` folder
- [ ] Genereer component met Angular CLI of handmatig
- [ ] Implementeer component volgens ontwerp
- [ ] Schrijf unit tests (basic)

### Fase 2: Eenvoudige Migratie (4 componenten)
Start met componenten zonder speciale cases:

**2.1 Validator** (meest straightforward)
```html
<!-- Voor -->
<div class="card-header d-flex justify-content-between align-items-center" style="flex-shrink: 0">
  <span>
    <i class="fas fa-check-circle me-2"></i>
    Fhir Validator
  </span>
  <app-json-viewer-toolbar
    [editor]="this.component?.editor"
    [readOnly]="false">
  </app-json-viewer-toolbar>
</div>

<!-- Na -->
<app-result-header
  icon="fa-check-circle"
  title="Fhir Validator"
  [editor]="this.component?.editor"
  [readOnly]="false">
</app-result-header>
```

**2.2 FhirPath**
```html
<app-result-header
  icon="fa-sitemap"
  title="FhirPath Tester"
  [editor]="this.component?.editor"
  [readOnly]="true">
</app-result-header>
```

**2.3 Pluriform**
```html
<app-result-header
  icon="fa-shapes"
  title="XML Transformation"
  [editor]="this.leftEditor?.editor"
  [readOnly]="false">
</app-result-header>
```

**2.4 Query (text mode)**
```html
<app-result-header
  icon="fa-file-lines"
  title="Result"
  [editor]="this.component?.editor"
  [readOnly]="true">
</app-result-header>
```

### Fase 3: Complexere Migratie (3 componenten)

**3.1 Query (visual mode)**
```html
<app-result-header
  icon="fa-file-lines"
  title="Result"
  [editor]="this.componentVisual?.editor"
  [readOnly]="true">
</app-result-header>
```

**3.2 Predefined** (conditional toolbar)
```html
<app-result-header
  icon="fa-file-lines"
  title="Result"
  [showToolbar]="result() && !loading()"
  [editor]="this.component?.editor"
  [readOnly]="true">
</app-result-header>
```

**3.3 Terminology** (padding + extra wrapper)
```html
<app-result-header
  icon="fa-chart-bar"
  title="Results"
  [editor]="this.component?.editor"
  [readOnly]="true"
  padding="small">
</app-result-header>
```

**3.4 Logs** (no toolbar, live badge)
```html
<app-result-header
  icon="fa-list"
  title="Application Logs"
  [showToolbar]="false">

  <!-- Badge via content projection -->
  @if (watching()) {
    <span slot="title-suffix" class="badge bg-success ms-2">
      <i class="fas fa-eye me-1"></i>Live
    </span>
  }
</app-result-header>
```

### Fase 4: Testing & Refinement
- [ ] Test elke migratie visueel in de app
- [ ] Controleer toolbar functionaliteit (save/load)
- [ ] Controleer responsive behavior
- [ ] Controleer theming (dark/light mode indien relevant)
- [ ] Code review

### Fase 5: Documentation & Cleanup
- [ ] Update IMPLEMENTATION_LOG.md
- [ ] Voeg JSDoc comments toe
- [ ] Commit met duidelijke message
- [ ] Push en maak PR

## Voordelen

**Code Reductie:**
- 7 duplicate headers → 1 shared component
- ~150 lines code eliminatie
- Betere maintainability

**Consistency:**
- Uniforme styling
- Uniforme behavior
- Eenvoudiger om wijzigingen door te voeren

**Type Safety:**
- Input validation via TypeScript
- Duidelijke API

## Risico's & Mitigaties

**Risico 1: Breaking Changes**
- Mitigatie: Zorgvuldig testen per component
- Mitigatie: Visuele verificatie na elke wijziging

**Risico 2: Content Projection Complexity**
- Mitigatie: Start met simpele gevallen (Validator, FhirPath)
- Mitigatie: Test Logs (complexe case) als laatste

**Risico 3: Styling Inconsistencies**
- Mitigatie: Vergelijk screenshots voor/na
- Mitigatie: Test in beide themes indien applicable

## Tijdsinschatting
- Fase 1: 30 min (component setup)
- Fase 2: 1 uur (4 eenvoudige migraties + testing)
- Fase 3: 1 uur (3 complexe migraties + testing)
- Fase 4: 30 min (final testing)
- Fase 5: 20 min (documentation)

**Totaal: ~3.5 uur**

## Rollback Plan
Indien issues ontstaan:
1. Check git diff per component
2. Revert specifieke component via `git checkout main -- <file>`
3. Analyseer probleem
4. Fix en retry

## Next Steps
1. Review dit plan
2. Start met Fase 1: Component creatie
3. Iteratief implementeren per fase
4. Testen na elke fase
