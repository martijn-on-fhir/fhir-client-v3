# Predefined Templates Migration Plan (v2 → v3)

**Created**: 2026-01-09
**Branch**: `feature/predefined-dialog`
**Status**: Analysis Complete - Ready for Implementation

---

## Executive Summary

The Predefined Templates feature is **80% complete** in v3. The core functionality exists, but several key components need implementation or refinement to achieve feature parity with v2.

### What's Already Done ✅
- ✅ Main component structure (PredefinedComponent)
- ✅ Template browsing with search and filtering
- ✅ Template data model (SmartQueryTemplate, 21 system templates)
- ✅ Template service with localStorage persistence
- ✅ Query execution and Monaco editor result display
- ✅ Split panel with resize functionality
- ✅ Category organization and badges
- ✅ Basic UI scaffold for dialogs

### What Needs Implementation ⏳
- ⏳ **TemplateConfigDialog** - Parameter input dialog (exists but incomplete)
- ⏳ **TemplateEditorDialog** - Full template editor (scaffolding only)
- ⏳ **ReferenceSelectorDialog** integration - For reference parameters
- ⏳ **File operations** - Load template from file
- ⏳ **Template validation** - Parameter validation logic
- ⏳ **Expanded categories accordion** - Better UX for template browser

---

## Detailed Component Analysis

### 1. PredefinedComponent (Main Container)

**v2 Location**: `C:\projects\fhir-client-v2\src\components\predefined\PredefinedTab.tsx`
**v3 Location**: `C:\projects\fhir-client-v3\src\app\features\predefined\predefined.component.ts`

**Migration Status**: ✅ 90% Complete

**What Exists**:
- Split panel layout with resizable divider
- Template browser on left (grouped by category)
- Results viewer on right with Monaco editor
- Search and category filtering
- Query execution with error handling
- Loading states

**What's Missing**:
1. **Load Template from File** - File operation integration
   - v2 uses: `window.electronAPI.file.openFile()`
   - v3 needs: Same IPC call (already available)
   - Implementation: ~20 lines

2. **ReactJson vs Monaco** - Result display difference
   - v2: Uses `@microlink/react-json-view` with collapse controls
   - v3: Uses Monaco editor (better for large JSON)
   - Decision: Keep Monaco - it's superior

3. **Template Delete Confirmation** - Not fully implemented
   - v2: Alert + confirmation
   - v3: TODO in `deleteTemplate()` method

**Action Items**:
```typescript
// TODO 1: Implement loadTemplate()
async loadTemplate() {
  const result = await (window as any).electronAPI?.file?.openFile();
  if (result?.content) {
    const template = JSON.parse(result.content);
    this.templateService.saveTemplate(template);
    this.refreshKey.update(v => v + 1);
  }
}

// TODO 2: Add delete confirmation
deleteTemplate(template: SmartQueryTemplate) {
  if (template.isSystem) {
    alert('Cannot delete system templates');
    return;
  }
  if (confirm(`Delete "${template.name}"?`)) {
    this.templateService.deleteTemplate(template.id);
    this.refreshKey.update(v => v + 1);
  }
}
```

---

### 2. TemplateConfigDialog (Parameter Input)

**v2 Location**: `C:\projects\fhir-client-v2\src\components\predefined\templates\TemplateConfigDialog.tsx`
**v3 Location**: ❌ **MISSING** - Needs creation

**Status**: ⏳ **HIGH PRIORITY** - Critical for template execution

**Requirements**:
- Modal dialog for configuring template parameters
- Type-specific input widgets:
  - `string` → text input
  - `number` → number input with min/max
  - `date` → HTML5 date picker
  - `boolean` → checkbox/switch
  - `choice` → dropdown select
  - `reference` → text input + reference selector button
  - `token` → text input
  - `summary` → dropdown (_summary FHIR param)
  - `sort` → dropdown (_sort FHIR param)
- Validation: Required field checking, regex patterns
- Preview: Show generated query string
- Integration with ReferenceSelectorDialog

**Implementation Plan**:
1. Create `src/app/features/predefined/dialogs/template-config-dialog.component.ts`
2. Port from v2 with these adaptations:
   - React → Angular (signals, FormsModule)
   - useState → signal()
   - Props → @Input/@Output
   - useMemo → computed()
3. Import ReferenceSelectorDialog (already exists in v3)
4. Add to PredefinedComponent imports

**Estimated Effort**: 3-4 hours
**Lines of Code**: ~350 lines

---

### 3. TemplateEditorDialog (Full Template Editor)

**v2 Location**: `C:\projects\fhir-client-v2\src\components\predefined\TemplateEditorDialog.tsx`
**v3 Location**: Scaffolding exists, needs full implementation

**Status**: ⏳ **MEDIUM PRIORITY** - For power users

**Requirements**:
- Full-screen modal with 3-panel layout:
  - **Left**: Template metadata (name, description, category, tags, author)
  - **Middle**: Query template editor (Monaco with parameter highlighting)
  - **Right**: Parameter management (add/edit/delete parameters)
- Parameter editor with ParameterEditor component
- Template validation (required fields, parameter placeholders)
- Auto-detect parameters from query template
- Save to localStorage (custom templates)
- Create custom copy from system template

**Implementation Plan**:
1. Create `src/app/features/predefined/dialogs/template-editor-dialog.component.ts`
2. Create `src/app/features/predefined/dialogs/parameter-editor.component.ts`
3. Port from v2 (~800 lines total)
4. Use existing Monaco editor wrapper
5. Integrate with TemplateService

**Estimated Effort**: 6-8 hours
**Lines of Code**: ~800 lines (split across 2 components)

---

### 4. TemplateBrowser Component (Enhancement)

**v2 Location**: `C:\projects\fhir-client-v2\src\components\predefined\templates\TemplateBrowser.tsx`
**v3 Location**: Inline in predefined.component.html

**Status**: ⏳ **LOW PRIORITY** - Enhancement

**Current v3 Implementation**:
- Templates grouped by category
- Simple card list
- Search and filter working

**v2 Has Better UX**:
- **Accordion** for categories (collapsible)
- Edit/Delete buttons on each template card
- Expanded state persistence
- System badge on built-in templates

**Recommendation**: Extract to separate component

**Implementation Plan**:
1. Create `src/app/features/predefined/components/template-browser.component.ts`
2. Use Bootstrap accordion (already available)
3. Add expanded state tracking with signals
4. Move template card logic from main component

**Estimated Effort**: 2-3 hours
**Lines of Code**: ~250 lines

---

### 5. ReferenceSelectorDialog Integration

**v2 Location**: `C:\projects\fhir-client-v2\src\components\dialogs\ReferenceSelectorDialog.tsx`
**v3 Location**: `C:\projects\fhir-client-v3\src\app\shared\components\reference-selector-dialog\`

**Status**: ✅ Component exists, ⏳ Integration needed

**What Exists in v3**:
- Full ReferenceSelectorDialog component
- Search across resource types
- Result list with selection
- Already used in ResourceEditorDialog

**What's Needed**:
- Import into TemplateConfigDialog
- Pass reference types from parameter definition
- Handle selection callback

**Implementation**: ✅ Straightforward - 30 minutes

---

### 6. File Operations (Load Template)

**Status**: ⏳ **LOW PRIORITY** - Nice to have

**v2 Implementation**:
```typescript
const result = await window.electronAPI.file.openFile();
if (result?.content) {
  const template = JSON.parse(result.content);
  // Add to localStorage
}
```

**v3 Needs**:
- File IPC handlers already exist (`electron/file/file-handler.js`)
- Just needs method in PredefinedComponent

**Estimated Effort**: 30 minutes

---

### 7. Template Validation

**v2 Location**: `C:\projects\fhir-client-v2\src\utils\template-validator.ts`
**v3 Location**: ❌ **MISSING**

**Status**: ⏳ **MEDIUM PRIORITY**

**Validation Rules**:
1. **Required fields**: name, description, category, queryTemplate
2. **Parameter names**: Alphanumeric + hyphen/underscore only
3. **Parameter uniqueness**: No duplicate parameter names
4. **Placeholder validation**: All `{{params}}` in query have definitions
5. **Orphan parameters**: Warn if parameter defined but not used
6. **Choice validation**: Choice type must have options
7. **Regex validation**: Pattern must be valid regex

**Implementation Plan**:
1. Create `src/app/core/utils/template-validator.ts`
2. Port validation logic from v2
3. Return structured errors/warnings
4. Use in TemplateEditorDialog before save

**Estimated Effort**: 2 hours
**Lines of Code**: ~200 lines

---

### 8. Template Processor (Rendering)

**v2 Location**: `C:\projects\fhir-client-v2\src\utils\template-processor.ts`
**v3 Location**: Partially in `TemplateService.renderTemplate()`

**Status**: ✅ Core exists, ⏳ Enhancements needed

**What Exists**:
- Basic parameter substitution (`{{param}}` → value)
- URL encoding

**What's Missing** (v2 has):
- **Special tokens**: `{{today}}`, `{{today-7}}`, `{{now}}`, `{{uuid}}`
- **Empty parameter cleanup**: Remove `&param=` if value is empty
- **Default values**: Apply defaults before rendering
- **Parameter extraction**: Auto-detect parameters from template string

**Enhancement Plan**:
```typescript
// Add to TemplateService
private processSpecialTokens(value: string): string {
  const today = new Date().toISOString().split('T')[0];
  return value
    .replace(/\{\{today\}\}/g, today)
    .replace(/\{\{today-(\d+)\}\}/g, (_, days) => {
      const date = new Date();
      date.setDate(date.getDate() - parseInt(days));
      return date.toISOString().split('T')[0];
    })
    .replace(/\{\{now\}\}/g, new Date().toISOString())
    .replace(/\{\{uuid\}\}/g, crypto.randomUUID());
}
```

**Estimated Effort**: 1-2 hours

---

## Priority Roadmap

### Phase 1: Core Functionality (MVP)
**Goal**: Template execution works end-to-end
**Duration**: 1 day

1. ✅ **TemplateConfigDialog** (3-4 hours)
   - Parameter input form
   - Type-specific widgets
   - Validation
   - Execute button → generate query

2. ⏳ **ReferenceSelectorDialog Integration** (30 min)
   - Import and wire up
   - Handle reference parameter selection

3. ⏳ **Template Processor Enhancements** (1-2 hours)
   - Special tokens ({{today}}, etc.)
   - Empty parameter cleanup
   - Default values

**Deliverable**: Users can configure and execute all 21 system templates

---

### Phase 2: Template Management
**Goal**: Users can create/edit custom templates
**Duration**: 2 days

1. ⏳ **Template Validation** (2 hours)
   - Validation utility
   - Error/warning display

2. ⏳ **ParameterEditor Component** (3 hours)
   - Standalone parameter form
   - Type-specific fields
   - Validation

3. ⏳ **TemplateEditorDialog** (6-8 hours)
   - 3-panel layout
   - Monaco query editor
   - Parameter management
   - Save/update templates

**Deliverable**: Users can create and modify custom templates

---

### Phase 3: UX Polish
**Goal**: Match v2 UX quality
**Duration**: 1 day

1. ⏳ **TemplateBrowser Component** (2-3 hours)
   - Extract to separate component
   - Accordion for categories
   - Edit/delete buttons
   - Expanded state persistence

2. ⏳ **File Operations** (30 min)
   - Load template from file
   - Export template to file

3. ⏳ **Template Delete Confirmation** (15 min)
   - Confirm dialog
   - Clear selection after delete

4. ⏳ **Usage Count Display** (30 min)
   - Show usage badge on templates
   - Sort by popularity option

**Deliverable**: Feature parity with v2 + Angular benefits

---

## Technical Decisions

### React vs Angular Patterns

| v2 (React) | v3 (Angular) | Notes |
|------------|--------------|-------|
| `useState(x)` | `signal(x)` | Signals are more performant |
| `useMemo(() => x)` | `computed(() => x)` | Better dependency tracking |
| `useEffect(() => {})` | `effect(() => {})` | Signals-based reactivity |
| Props drilling | Dependency injection | Cleaner architecture |
| `@microlink/react-json-view` | Monaco Editor | Better for large JSON |
| Bootstrap modals | Angular + Bootstrap | Use `[class]` bindings |

### Component Structure

```
src/app/features/predefined/
├── predefined.component.ts              ✅ Exists
├── predefined.component.html            ✅ Exists
├── predefined.component.scss            ✅ Exists
├── components/
│   └── template-browser.component.ts    ⏳ To create (optional)
└── dialogs/
    ├── template-config-dialog.component.ts    ⏳ To create (HIGH PRIORITY)
    ├── template-editor-dialog.component.ts    ⏳ To create
    └── parameter-editor.component.ts          ⏳ To create
```

---

## Migration Checklist

### Prerequisites ✅
- [x] Angular component structure
- [x] SmartQueryTemplate model
- [x] TemplateService
- [x] 21 system templates
- [x] Monaco editor wrapper
- [x] ReferenceSelectorDialog component
- [x] File IPC handlers

### Phase 1: Core (MVP) ⏳
- [ ] Create TemplateConfigDialog component
- [ ] Implement parameter input widgets
- [ ] Add validation for required fields
- [ ] Integrate ReferenceSelectorDialog
- [ ] Enhance template processor (special tokens)
- [ ] Test all 21 system templates
- [ ] Handle empty parameters gracefully

### Phase 2: Management ⏳
- [ ] Create template-validator utility
- [ ] Create ParameterEditor component
- [ ] Create TemplateEditorDialog component
- [ ] Implement 3-panel layout with Monaco
- [ ] Add parameter auto-detection
- [ ] Save custom templates
- [ ] Create copy from system template
- [ ] Delete custom templates

### Phase 3: Polish ⏳
- [ ] Extract TemplateBrowser component
- [ ] Implement accordion for categories
- [ ] Add expanded state persistence
- [ ] Load template from file
- [ ] Export template to file
- [ ] Confirmation dialogs
- [ ] Usage count display
- [ ] Sort by popularity
- [ ] Keyboard shortcuts (Ctrl+Enter to execute)

---

## Testing Strategy

### Manual Testing Checklist
1. **Template Browsing**
   - [ ] Search templates by name/description/tags
   - [ ] Filter by category
   - [ ] Select template opens config dialog

2. **Template Execution**
   - [ ] Fill all required parameters
   - [ ] Execute generates correct query
   - [ ] Query executes successfully
   - [ ] Results display in Monaco editor
   - [ ] Handle execution errors gracefully

3. **Reference Parameters**
   - [ ] Reference selector opens
   - [ ] Search and select reference
   - [ ] Reference ID populates parameter

4. **Special Tokens**
   - [ ] `{{today}}` → current date
   - [ ] `{{today-7}}` → 7 days ago
   - [ ] `{{now}}` → current ISO datetime
   - [ ] `{{uuid}}` → random UUID

5. **Template Management**
   - [ ] Create new custom template
   - [ ] Edit existing custom template
   - [ ] Edit system template (creates copy)
   - [ ] Delete custom template
   - [ ] Cannot delete system template
   - [ ] Load template from file
   - [ ] Export template to file

6. **Validation**
   - [ ] Required field enforcement
   - [ ] Parameter name uniqueness
   - [ ] Placeholder validation
   - [ ] Regex pattern validation
   - [ ] Warning for unused parameters

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Parameter types mismatch | Low | Medium | Use TypeScript strict mode, comprehensive testing |
| Monaco editor integration issues | Low | High | Already working in v3, proven pattern |
| localStorage size limits | Low | Low | Templates are small (<5KB each), monitor usage |
| Validation edge cases | Medium | Medium | Port comprehensive tests from v2 |
| Reference selector bugs | Low | Medium | Component already tested in ResourceEditorDialog |

---

## Performance Considerations

1. **Template Filtering**
   - ✅ Uses Angular computed() - only recomputes on dependency change
   - ✅ Efficient string matching (no regex in hot path)

2. **Monaco Editor**
   - ✅ Lazy-loaded
   - ✅ Single instance reused
   - ⚠️ Large JSON results may lag - consider virtualization if >1MB

3. **LocalStorage**
   - ✅ Read once on init
   - ✅ Write debounced
   - ⚠️ 5MB limit - monitor usage

4. **Signal Updates**
   - ✅ Batched by Angular
   - ✅ More efficient than RxJS for local state

---

## Success Criteria

### Definition of Done
- [ ] All 21 system templates execute successfully
- [ ] Users can configure parameters with appropriate widgets
- [ ] Reference selector works for reference parameters
- [ ] Special tokens ({{today}}, etc.) work correctly
- [ ] Users can create custom templates
- [ ] Users can edit custom templates
- [ ] System templates can be copied to custom
- [ ] Templates can be loaded from file
- [ ] Templates can be deleted (custom only)
- [ ] Search and filtering work correctly
- [ ] Layout matches v2 (split panel, toolbar)
- [ ] No console errors
- [ ] All TypeScript strict mode warnings resolved

### Acceptance Criteria
1. **Feature Parity**: All v2 features present in v3
2. **UX Quality**: Same or better UX than v2
3. **Performance**: Template execution <500ms for simple queries
4. **Stability**: No crashes or data loss
5. **Code Quality**: TypeScript strict mode, ESLint clean

---

## Next Steps

1. **Immediate** (Today):
   - ✅ Create migration plan (this document)
   - ⏳ Review plan with team
   - ⏳ Start Phase 1: TemplateConfigDialog

2. **This Week**:
   - ⏳ Complete Phase 1 (MVP)
   - ⏳ Test all system templates
   - ⏳ User acceptance testing

3. **Next Week**:
   - ⏳ Complete Phase 2 (Management)
   - ⏳ Complete Phase 3 (Polish)
   - ⏳ Final testing and bug fixes

4. **Follow-up**:
   - ⏳ Merge to master
   - ⏳ Update MIGRATION_STATUS.md
   - ⏳ Create user documentation

---

## Questions for Review

1. **Priority**: Should we focus on MVP (Phase 1) first, or implement full template editor in one go?
   - **Recommendation**: MVP first - validates architecture, provides immediate value

2. **Template Editor**: Should we use Monaco for query template editing, or simple textarea?
   - **Recommendation**: Monaco - syntax highlighting, parameter detection, better UX

3. **File Operations**: High priority or optional enhancement?
   - **Recommendation**: Low priority - nice to have, not critical

4. **Testing**: Should we add unit tests, or rely on manual testing?
   - **Recommendation**: Manual testing for now, unit tests if time permits

5. **Template Browser**: Keep inline or extract to component?
   - **Recommendation**: Extract - improves maintainability, follows Angular best practices

---

**Document Status**: ✅ Ready for Implementation
**Last Updated**: 2026-01-09
**Author**: Claude Sonnet 4.5
