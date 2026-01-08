# ResourceEditorDialog - TODO List

## ✅ Completed Features

- [x] 3-panel resizable layout (Properties | Editor | Validation)
- [x] Property browser (Required/Optional accordions)
- [x] Monaco editor integration (CDN loader)
- [x] Blueprint generation with meta.profile
- [x] Type-aware default values (33+ FHIR types)
- [x] FHIR $validate operation
- [x] OperationOutcome display by severity
- [x] CREATE (POST) operation
- [x] UPDATE (PUT) operation
- [x] Keyboard shortcuts (Ctrl+Alt+L, Escape)
- [x] Signal-based reactivity
- [x] Memory leak prevention
- [x] Integration in Nictiz tab
- [x] Integration in Profiles tab

---

## 🚧 Advanced Features (From v2)

### High Priority

- [x] **Context-Aware Autocomplete** (autocomplete.ts uit v2) ✅ COMPLETED (commit bfb0dc5)
  - [x] Detect cursor position in JSON
  - [x] Suggest property names based on current context
  - [x] Extract enum values from StructureDefinition
    - [x] From element.short (e.g., "active | inactive")
    - [x] From element.binding.valueSet
    - [x] From element.constraint
  - [x] Type-aware suggestions (string, code, boolean, etc.)
  - [x] Snippet insertion for complex types
  - [x] Array item insertion with proper comma handling

- [x] **Template System** (uit v2) ✅ COMPLETED (commit bfb0dc5)
  - [x] ~~Parse r3.d.ts TypeScript interfaces~~ (using hardcoded templates instead)
  - [x] ~~Extract FHIR type definitions~~ (hardcoded in fhir-templates.ts)
  - [x] Generate templates for complex types:
    - [x] CodeableConcept with coding array
    - [x] Identifier with system/value
    - [x] HumanName with family/given
    - [x] Address with line/city/postalCode
    - [x] Quantity with value/unit/system/code
  - [x] ~~Cache parsed templates~~ (not needed with hardcoded approach)
  - [x] Fallback to hardcoded templates (using hardcoded as primary)

- [x] **Reference Selector Dialog** (ReferenceSelectorDialog.tsx uit v2) ✅ COMPLETED (commit dab09df)
  - [x] Alt+Enter keyboard shortcut detection
  - [x] Detect if cursor is on Reference type
  - [x] ~~Extract target resource types from element.type[].targetProfile~~ (user searches manually)
  - [x] Search dialog with resource type filter
  - [x] ~~Real-time search with debounce~~ (search on Execute button)
  - [x] Display search results in table
  - [x] Insert selected reference into JSON
  - [x] Format: `{ reference: "Patient/123", display: "John Doe" }`

### Medium Priority

- [x] **Smart Auto-Correct** (keyListeners.ts uit v2) ✅ COMPLETED (commit 30915f6)
  - [x] ~~Detect content after closing `}` or `]`~~ (checks next line instead)
  - [x] ~~Move content back inside bracket~~ (prevents issue via smart comma)
  - [x] Auto-insert commas in arrays (after closing bracket)
  - [x] ~~Remove trailing commas~~ (Monaco handles this)
  - [x] Smart Enter key behavior (comma insertion)

- [x] **Navigate Empty Values** (keyListeners.ts uit v2) ✅ COMPLETED (commit 250cdd1)
  - [x] Ctrl+↑ - Jump to previous empty value (`""`, `[]`, `{}`, `null`)
  - [x] Ctrl+↓ - Jump to next empty value
  - [x] ~~Highlight empty value for easy filling~~ (cursor positioned inside value instead)

- [ ] **Error Handling Improvements**
  - [ ] Better error messages for invalid JSON
  - [ ] Highlight JSON syntax errors in editor
  - [ ] Show validation errors inline in editor (markers)
  - [ ] Auto-scroll to first error on validation

- [ ] **Property Browser Enhancements**
  - [ ] Search/filter properties
  - [ ] Show cardinality in property list (0..1, 1..1, 0..*, 1..*)
  - [ ] Show binding strength (required, extensible, preferred, example)
  - [ ] Show value set URL on hover
  - [ ] Click property to jump to location in JSON
  - [ ] Show property path (e.g., Patient.name.given)

### Low Priority

- [ ] **Copy/Paste Support**
  - [ ] Copy current resource to clipboard (formatted JSON)
  - [ ] Paste resource from clipboard
  - [ ] Import from file
  - [ ] Export to file

- [ ] **History/Undo**
  - [ ] Undo/Redo for property additions
  - [ ] History of validation results
  - [ ] Compare with previous version

- [ ] **Multi-Resource Support**
  - [ ] Create contained resources
  - [ ] Reference contained resources
  - [ ] Bundle creation

---

## 🐛 Known Issues / Bugs to Fix

- [ ] **Monaco Editor Loading**
  - [ ] Test CDN fallback if jsDelivr is down
  - [ ] Add loading indicator while Monaco loads
  - [ ] Handle Monaco load failure gracefully

- [ ] **Validation Edge Cases**
  - [ ] Handle validation timeout
  - [ ] Handle server errors (500, 404)
  - [ ] Test with resources that have no StructureDefinition
  - [ ] Test with custom profiles

- [ ] **Property Extraction Edge Cases**
  - [ ] Handle StructureDefinitions without snapshot
  - [ ] Handle elements with choice types (e.g., value[x])
  - [ ] Handle elements with slicing
  - [ ] Handle backbone elements properly

- [ ] **Resource Creation Edge Cases**
  - [ ] Handle resources without required fields
  - [ ] Handle server-side validation failures
  - [ ] Handle authentication errors
  - [ ] Handle network errors

---

## 🎨 UI/UX Improvements

- [ ] **Visual Polish**
  - [ ] Add animations for panel resize
  - [ ] Add transitions for accordion expand/collapse
  - [ ] Improve loading states (skeleton screens)
  - [ ] Add success/error toast notifications
  - [ ] Improve button states (loading, disabled, success)

- [ ] **Accessibility**
  - [ ] Keyboard navigation for property list
  - [ ] Focus management (trap focus in dialog)
  - [ ] ARIA labels for screen readers
  - [ ] High contrast mode support

- [ ] **Responsive Design**
  - [ ] Mobile layout (stack panels vertically?)
  - [ ] Tablet layout
  - [ ] Test on different screen sizes

- [ ] **Dark Mode**
  - [ ] Test all UI elements in dark mode
  - [ ] Ensure proper contrast
  - [ ] Monaco editor theme sync

---

## 📚 Documentation

- [x] **User Documentation** ✅ COMPLETED (commit ab52179)
  - [x] ~~How to create a resource~~ (self-explanatory in UI)
  - [x] ~~How to use property browser~~ (self-explanatory in UI)
  - [x] ~~How to validate~~ (self-explanatory in UI)
  - [x] Keyboard shortcuts reference (modal in editor)
  - [x] Common workflows (tip in shortcuts modal)

- [ ] **Developer Documentation**
  - [ ] Architecture overview
  - [ ] Component API documentation
  - [ ] Signal flow diagram
  - [ ] How to add new FHIR types
  - [ ] How to extend autocomplete

- [ ] **Code Comments**
  - [ ] Add JSDoc comments to all public methods
  - [ ] Document complex algorithms (autocomplete, template parsing)
  - [ ] Add examples in comments

---

## 🧪 Testing

- [ ] **Unit Tests**
  - [ ] Property extraction logic
  - [ ] Blueprint generation
  - [ ] Default value generation for all types
  - [ ] Signal reactivity
  - [ ] Template parsing

- [ ] **Integration Tests**
  - [ ] Dialog open/close flow
  - [ ] Property addition
  - [ ] Validation flow
  - [ ] Create resource flow
  - [ ] Update resource flow

- [ ] **E2E Tests**
  - [ ] Full create resource workflow
  - [ ] Full edit resource workflow
  - [ ] Error handling scenarios

- [ ] **Performance Tests**
  - [ ] Large StructureDefinitions (100+ elements)
  - [ ] Large resources (deep nesting)
  - [ ] Rapid open/close (memory leak check)
  - [ ] Monaco editor performance

---

## 🔧 Technical Debt

- [ ] **Type Safety**
  - [ ] Replace `any` types with proper FHIR interfaces
  - [ ] Create ElementProperty interface in separate file
  - [ ] Use discriminated unions for different element types

- [ ] **Code Organization**
  - [ ] Extract autocomplete logic to separate service
  - [ ] Extract template system to separate service
  - [ ] Extract default value logic to utility file
  - [ ] Create models for StructureDefinition, Element, etc.

- [ ] **Error Handling**
  - [ ] Create custom error types
  - [ ] Centralized error handling
  - [ ] Error reporting to external service?

- [ ] **Performance Optimization**
  - [ ] Lazy load Monaco editor (only when dialog opens)
  - [ ] Cache StructureDefinition parsing
  - [ ] Debounce editor changes for validation
  - [ ] Virtual scrolling for large property lists

---

## 🚀 Future Enhancements

- [ ] **AI-Powered Features**
  - [ ] Smart field suggestions based on existing data
  - [ ] Auto-complete based on similar resources
  - [ ] Validation with AI-powered suggestions

- [ ] **Collaboration Features**
  - [ ] Real-time collaborative editing
  - [ ] Comments on specific fields
  - [ ] Review/approval workflow

- [ ] **Advanced Validation**
  - [ ] Custom validation rules
  - [ ] Cross-resource validation
  - [ ] Business rule validation

- [ ] **Import/Export**
  - [ ] Import from HL7v2
  - [ ] Import from CSV
  - [ ] Export to different formats
  - [ ] Bulk create from template

---

## 📋 Immediate Next Steps (Priority Order)

1. ~~**Test Current Implementation**~~ ✅ DONE
   - ~~Manual testing in Electron app~~
   - ~~Fix any runtime bugs found~~ (cache reconstruction fix applied)
   - ~~Verify all basic functionality works~~ (properties panel now populated)

2. ~~**Context-Aware Autocomplete**~~ ✅ DONE (commit bfb0dc5)
   - ~~Start with property name suggestions~~
   - ~~Then add enum value suggestions~~
   - ~~Use v2's autocomplete.ts as reference~~

3. ~~**Template System**~~ ✅ DONE (commit bfb0dc5)
   - ~~Parse r3.d.ts or use hardcoded templates~~ (used hardcoded)
   - ~~Integrate with property addition~~ (integrated in autocomplete)

4. ~~**Test Autocomplete in Electron**~~ ✅ DONE
   - ~~Open Resource Editor dialog~~
   - ~~Test property name suggestions~~
   - ~~Test enum value suggestions~~
   - ~~Test nested context detection~~

5. ~~**Reference Selector Dialog**~~ ✅ DONE (commit dab09df)
   - ~~Implement basic search~~
   - ~~Alt+Enter shortcut~~
   - ~~Reference insertion~~

6. ~~**Navigate Empty Values**~~ ✅ DONE (commit 250cdd1)
   - ~~Ctrl+↑/↓ shortcuts~~
   - ~~Jump to "", [], {}, null~~

7. ~~**Keyboard Shortcuts Help**~~ ✅ DONE (commit ab52179)
   - ~~Modal with all shortcuts~~
   - ~~Workflow tips~~

8. **Next Options** 🎯
   - Smart Auto-Correct (complex but useful)
   - Error Handling Improvements (production readiness)
   - Property Browser Enhancements (better UX)
   - Testing & Bug fixes

---

## 🎯 Success Metrics

- [ ] Can create a valid Patient resource in < 2 minutes
- [ ] Can create a valid Observation resource in < 3 minutes
- [ ] No console errors during normal operation
- [ ] Monaco editor loads within 2 seconds
- [ ] Validation completes within 3 seconds
- [ ] Dialog opens/closes smoothly without lag
- [ ] No memory leaks after 10+ open/close cycles

---

## 📝 Notes

- Keep v2 implementation as reference: `C:\projects\fhir-client-v2\src\components\resource-editor\`
- Focus on core functionality first, polish later
- Prioritize features that improve usability over visual polish
- Test with real FHIR servers, not just mock data
- Consider backwards compatibility with FHIR R4, R5

---

**Last Updated:** 2026-01-08
**Current Branch:** `feature/resource-editor-dialog`
**Status:** Core functionality complete, advanced features pending
