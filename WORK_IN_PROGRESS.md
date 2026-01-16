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
```

## Commit Suggestie

Na testen:
```bash
git add -A
git commit -m "feat: add edit button for single resources in query results

- Add Ctrl+click link handler in Monaco editor to follow FHIR references
- Add edit button in toolbar (visible only for single resources, not Bundles)
- Move ResourceEditorDialog to app.component for global access
- Add NavigationService.openResourceEditor() for cross-component communication
"
```
