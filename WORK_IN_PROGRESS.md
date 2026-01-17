# Work in Progress - Monaco Editor Features

## Datum: 16 januari 2026

## Overzicht

Twee nieuwe features toegevoegd aan de Monaco editor in de query tab:

### 1. Ctrl+Click Link Handler

**Status:** Voltooid

Wanneer je Ctrl+click doet op een URL in het JSON resultaat:
- Als de URL begint met de FHIR server URL → strip de base URL en voer uit als query
- Maakt snelle navigatie naar gerefereerde resources mogelijk

**Bestanden:**
- `src/app/shared/components/monaco-editor/monaco-editor.component.ts` - `registerLinkOpener()` methode
- `src/app/features/query/query.component.ts` - `onLinkClicked()` handler
- `src/app/features/query/query.component.html` - `(linkClicked)` binding

### 2. Edit Button voor Single Resources

**Status:** In progress - testen nodig

Een "Edit" knop in de toolbar die alleen zichtbaar is bij single resources (niet bij Bundles).

**Bestanden gewijzigd:**

| Bestand | Wijziging |
|---------|-----------|
| `src/app/shared/components/json-viewer-toolbar/json-viewer-toolbar.component.ts` | `showEditButton` input, `editClicked` output |
| `src/app/shared/components/json-viewer-toolbar/json-viewer-toolbar.component.html` | Edit button na save button |
| `src/app/shared/components/result-header/result-header.component.ts` | Doorgeefluik voor showEditButton/editClicked |
| `src/app/shared/components/result-header/result-header.component.html` | Props doorgeven aan toolbar |
| `src/app/features/query/query.component.ts` | `isSingleResource` computed, `onEditClicked()` |
| `src/app/features/query/query.component.html` | Bindings voor beide editors |
| `src/app/core/services/navigation.service.ts` | `editResourceEvent`, `openResourceEditor()` |
| `src/app/app.component.ts` | ResourceEditorDialog global, effect listener |
| `src/app/features/nictiz/nictiz.component.ts` | Opgeschoond (effect verwijderd) |

**Flow:**
1. Query uitvoeren voor single resource (bijv. `/Patient/123`)
2. `isSingleResource` computed checkt of `resourceType !== 'Bundle'`
3. Edit knop verschijnt in toolbar (na save knop)
4. Klik op Edit → `navigationService.openResourceEditor(resource)`
5. `app.component` luistert via effect en opent `ResourceEditorDialog`
6. Dialog opent met resource geladen (minimale StructureDefinition wrapper)

## Te Testen

1. **Single resource ophalen:**
   - Query: `/Patient/123` of `/Observation/456`
   - Verwacht: Edit knop zichtbaar

2. **Bundle ophalen:**
   - Query: `/Patient` of `/Observation?code=...`
   - Verwacht: Edit knop NIET zichtbaar

3. **Edit klikken:**
   - Verwacht: ResourceEditorDialog opent direct (geen tab navigatie)
   - Resource JSON moet geladen zijn in de editor

## Mogelijke Verbeteringen

- [ ] StructureDefinition ophalen van server voor betere autocomplete in editor
- [ ] Na opslaan in editor, query resultaat refreshen
- [ ] Edit knop ook toevoegen aan predefined tab
- [ ] Keyboard shortcut voor edit (bijv. Ctrl+E)

## Uitbreiden: Ctrl+Click Functionaliteit

**Huidige implementatie:**
- Ctrl+click op URL in Monaco editor
- Locatie: `monaco-editor.component.ts` → `registerLinkOpener()`
- Handler: `query.component.ts` → `onLinkClicked()`

**URL patronen ondersteund:**

| URL patroon | Actie |
|-------------|-------|
| Begint met FHIR server URL | Strip base → voer uit als query |
| Bevat `StructureDefinition` | Query: `/administration/StructureDefinition?url=<URL>` |
| Begint met `http://hl7.org/fhir` | Query: `/administration/CodeSystem?url=<URL>` |
| Begint met `https://zibs.nl/wiki` | Open in externe browser |
| Code system URL (SNOMED, LOINC, etc.) | Navigeer naar Terminology tab en voer $lookup uit |
| Anders | Negeren (log message) |

### 3. Terminology Lookup via Ctrl+Click

**Status:** Voltooid

Wanneer je Ctrl+click doet op een code system URL in een coding object:
- Extraheert automatisch system, code en display uit de JSON context
- Navigeert naar de Terminology tab
- Vult system en code in
- Voert automatisch $lookup uit

**Ondersteunde code systems:**
- `http://snomed.info/sct`
- `http://loinc.org`
- `http://unitsofmeasure.org`
- `http://hl7.org/fhir/sid/`
- `urn:oid:`
- `urn:iso:std:iso:`
- `http://terminology.hl7.org/CodeSystem/`
- `http://hl7.org/fhir/CodeSystem/`

**Bestanden gewijzigd:**

| Bestand | Wijziging |
|---------|-----------|
| `src/app/shared/components/monaco-editor/monaco-editor.component.ts` | `codingClicked` output, `extractCodingContext()` methodes |
| `src/app/core/services/navigation.service.ts` | `terminologyLookupEvent`, `navigateToTerminologyLookup()` |
| `src/app/features/query/query.component.ts` | `onCodingClicked()` handler |
| `src/app/features/query/query.component.html` | `(codingClicked)` binding |
| `src/app/features/terminology/terminology.component.ts` | Effect voor ontvangen lookup event |

**Flow:**
1. JSON resultaat bevat coding object met system en code
2. Ctrl+click op de system URL (bijv. `http://snomed.info/sct`)
3. Monaco editor extraheert system + code uit de JSON context
4. Event wordt verstuurd naar query component
5. NavigationService triggert terminology lookup event
6. Router navigeert naar `/app/terminology`
7. Terminology component ontvangt event, vult parameters in, voert $lookup uit

**Ideeën voor uitbreiding:**
- [ ] Ondersteuning voor relative references (bijv. `Patient/123` zonder base URL)
- [x] ~~Ondersteuning voor HL7 FHIR canonical URLs~~ ✅ (CodeSystem lookup)
- [ ] Ondersteuning voor ValueSet URLs (syntax uitzoeken)
- [x] ~~Ondersteuning voor StructureDefinition URLs~~ ✅ (trigger op "StructureDefinition" in URL)
- [x] ~~Zibs wiki URLs~~ ✅ (open in externe browser)
- [ ] Preview popup bij hover over link (zonder klik)
- [ ] Ctrl+click op `reference` velden in JSON (niet alleen URLs)
- [ ] Context menu met opties (Open, Open in new tab, Copy URL)
- [ ] Breadcrumb navigatie (terug naar vorige resource)
- [ ] Ondersteuning in andere tabs (Predefined, Validator, FHIRPath)

## Uncommitted Changes

```
src/app/features/query/query.component.html
src/app/features/query/query.component.ts
src/app/shared/components/json-viewer-toolbar/json-viewer-toolbar.component.html
src/app/shared/components/json-viewer-toolbar/json-viewer-toolbar.component.ts
src/app/shared/components/result-header/result-header.component.html
src/app/shared/components/result-header/result-header.component.ts
src/app/shared/components/monaco-editor/monaco-editor.component.ts
src/app/core/services/navigation.service.ts
src/app/app.component.ts
src/app/features/nictiz/nictiz.component.ts
src/app/features/terminology/terminology.component.ts
electron/preload.js
electron/main.js
```

## Commit Suggestie

Na testen:
```bash
git add -A
git commit -m "feat: add edit button and ctrl+click features for query results

- Add Ctrl+click link handler in Monaco editor to follow FHIR references
- Add edit button in toolbar (visible only for single resources, not Bundles)
- Move ResourceEditorDialog to app.component for global access
- Add NavigationService.openResourceEditor() for cross-component communication
- Add shell.openExternal API for opening URLs in external browser (zibs.nl/wiki support)
- Add Ctrl+click on code system URLs to navigate to Terminology tab and execute $lookup
"
```
