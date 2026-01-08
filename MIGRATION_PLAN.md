# FHIR Client - React naar Angular Migratie Plan

## 📋 Overzicht

**Doel**: Volledige migratie van React v2 naar Angular 18+ in `C:\projects\fhir-client-v3`

**Status POC**: ✅ ProfilesTab werkend, basis architectuur staat

**Geschatte totale tijd**: 10-14 weken fulltime (8-10 weken als je Angular goed kent)

---

## 🎯 Fasering

### **Fase 1: Foundation & Core Services** (Week 1-2)
Bouwen op de huidige POC, alle basis services opzetten

### **Fase 2: Main Features - Tabs** (Week 3-6)
De 11 hoofd-tabs één voor één migreren

### **Fase 3: Dialogs & Components** (Week 7-8)
Alle dialogs en gedeelde components

### **Fase 4: Electron Integration** (Week 9-10)
IPC, OAuth2, file system, settings

### **Fase 5: Polish & Testing** (Week 11-12)
Tests, packaging, bug fixes, performance optimalisatie

### **Fase 6: Advanced Features** (Week 13-14)
Template systeem, auto-updates, advanced features

---

## 📅 Gedetailleerd Stappenplan

---

## **WEEK 1: Foundation & Services**

### ✅ Dag 1: Project Setup (DONE!)
- [x] Angular 18 project aangemaakt
- [x] Bootstrap + FontAwesome geïnstalleerd
- [x] Electron basis opgezet
- [x] ProfilesTab POC werkend

### 📝 Dag 2: Core Services - Basis
**Doel**: Alle basis services maken

**Taken**:
1. **AuthService** maken
   ```typescript
   src/app/core/services/auth.service.ts
   - login()
   - logout()
   - getCurrentUser()
   - isAuthenticated signal
   ```

2. **SettingsService** maken
   ```typescript
   src/app/core/services/settings.service.ts
   - serverUrl signal
   - theme signal
   - loadSettings()
   - saveSettings()
   ```

3. **ThemeService** maken
   ```typescript
   src/app/core/services/theme.service.ts
   - currentTheme signal
   - toggleTheme()
   - applyTheme()
   ```

**Bestanden te maken**:
- `src/app/core/services/auth.service.ts`
- `src/app/core/services/settings.service.ts`
- `src/app/core/services/theme.service.ts`
- `src/app/core/models/user.model.ts`
- `src/app/core/models/settings.model.ts`

**Tijdsinschatting**: 6-8 uur

---

### 📝 Dag 3: FHIR Services Uitbreiden
**Doel**: FhirService uitbreiden met alle benodigde methods

**Taken**:
1. **Uitbreiden FhirService** (huidige basis verbeteren)
   - TerminologyService integreren
   - Validation methods
   - Batch operations
   - Profile caching

2. **TerminologyService** maken
   ```typescript
   src/app/core/services/terminology.service.ts
   - lookupCode()
   - expandValueSet()
   - validateCode()
   ```

3. **ValidationService** maken
   ```typescript
   src/app/core/services/validation.service.ts
   - validateResource()
   - validateAgainstProfile()
   ```

**Bestanden**:
- `src/app/core/services/terminology.service.ts`
- `src/app/core/services/validation.service.ts`
- Update: `src/app/core/services/fhir.service.ts`

**Tijdsinschatting**: 8 uur

---

### 📝 Dag 4-5: Shared Components
**Doel**: Gedeelde components die overal gebruikt worden

**Taken**:
1. **LoadingSpinner** component
2. **ErrorAlert** component
3. **Card** wrapper component
4. **Accordion** component (Bootstrap wrapper)
5. **JsonViewer** component (voor results)

**Bestanden**:
```
src/app/shared/components/
├── loading-spinner/
├── error-alert/
├── card/
├── accordion/
└── json-viewer/
```

**Extra libraries**:
```bash
npm install prismjs @types/prismjs
```

**Tijdsinschatting**: 8-10 uur

---

## **WEEK 2: Layout & Navigation**

### 📝 Dag 1: Main Layout
**Doel**: Complete app layout met navigatie

**Taken**:
1. **Header Component**
   - Logo
   - Connection indicator
   - Theme toggle
   - Settings button

2. **Sidebar/TabBar Component**
   - Tab navigation
   - Active tab indicator
   - Icon + labels

3. **Layout Service**
   - activetab signal
   - switchTab()

**Bestanden**:
```
src/app/layout/
├── header/
│   ├── header.component.ts
│   └── header.component.html
├── tab-bar/
│   ├── tab-bar.component.ts
│   └── tab-bar.component.html
└── main-layout/
    ├── main-layout.component.ts
    └── main-layout.component.html
```

**Tijdsinschatting**: 6 uur

---

### 📝 Dag 2-3: Routing & Tab System
**Doel**: Angular routing voor alle tabs

**Taken**:
1. **Routes definiëren**
   ```typescript
   src/app/app.routes.ts
   - /query
   - /profiles
   - /validator
   - /terminology
   - /predefined
   - etc.
   ```

2. **Tab Navigation Service**
   - Centralized tab state
   - Tab switching logic
   - Query params preserveren

**Bestanden**:
- Update: `src/app/app.routes.ts`
- `src/app/core/services/navigation.service.ts`

**Tijdsinschatting**: 8 uur

---

### 📝 Dag 4-5: State Management Setup
**Doel**: Centralized state management

**Optie A**: NgRx Signal Store (Modern, recommended)
```bash
npm install @ngrx/signals
```

**Optie B**: Services met Signals (Simpeler, zoals nu)

**Beslissing**: Services met Signals (wat we nu hebben)

**Taken**:
1. **AppStateService** maken
   - Connection status
   - Current server
   - Loading states
   - Error states

2. **CacheService** maken (voor profile caching)
   - Cache operations met IndexedDB
   - Cache stats
   - Clear cache

**Bestanden**:
- `src/app/core/services/app-state.service.ts`
- `src/app/core/services/cache.service.ts`

**Tijdsinschatting**: 8 uur

---

## **WEEK 3-4: Main Tabs (Part 1)**

### Strategie: Één tab per dag, parallel testen

---

### 📝 Dag 1: FhirQueryTab
**Doel**: Query builder + execution

**Components**:
```
src/app/features/fhir-query/
├── fhir-query.component.ts
├── components/
│   ├── resource-selector/
│   ├── parameter-builder/
│   ├── query-preview/
│   ├── query-modifiers/
│   └── favorites-manager/
└── services/
    └── query-builder.service.ts
```

**Complexiteit**: ⭐⭐⭐⭐ (Complex, veel sub-components)

**Tijdsinschatting**: 12-16 uur

---

### 📝 Dag 2: ResourceBrowserTab
**Doel**: Browse FHIR resources

**Components**:
```
src/app/features/resource-browser/
├── resource-browser.component.ts
├── components/
│   ├── resource-card/
│   ├── resource-summary/
│   └── resource-list/
```

**Complexiteit**: ⭐⭐⭐

**Tijdsinschatting**: 8 uur

---

### 📝 Dag 3: ValidatorTab
**Doel**: FHIR resource validation

**Components**:
```
src/app/features/validator/
├── validator.component.ts
├── components/
│   ├── validation-input/
│   ├── validation-results/
│   └── issue-list/
```

**Dependencies**:
- ValidationService (already created)

**Complexiteit**: ⭐⭐⭐⭐

**Tijdsinschatting**: 10 uur

---

### 📝 Dag 4: TerminologyTab
**Doel**: CodeSystem & ValueSet lookups

**Components**:
```
src/app/features/terminology/
├── terminology.component.ts
├── components/
│   ├── code-lookup/
│   ├── valueset-expansion/
│   └── concept-display/
```

**Dependencies**:
- TerminologyService (already created)

**Complexiteit**: ⭐⭐⭐

**Tijdsinschatting**: 8 uur

---

### 📝 Dag 5: FhirPathTab
**Doel**: FHIRPath evaluator

**Components**:
```
src/app/features/fhirpath/
├── fhirpath.component.ts
├── components/
│   ├── path-editor/
│   └── path-result/
```

**External Library**:
```bash
# Already installed
npm install fhirpath
```

**Complexiteit**: ⭐⭐⭐

**Tijdsinschatting**: 6-8 uur

---

## **WEEK 5-6: Main Tabs (Part 2)**

### 📝 Dag 1-2: PredefinedTab (Templates)
**Doel**: Smart query templates systeem

**Components**:
```
src/app/features/predefined/
├── predefined.component.ts
├── components/
│   ├── template-browser/
│   ├── template-config-dialog/
│   ├── template-editor-dialog/
│   └── parameter-editor/
└── services/
    └── template.service.ts
```

**Models**:
```typescript
src/app/core/models/template.model.ts
- SmartQueryTemplate
- TemplateParameter
- TemplateCategory
```

**Complexiteit**: ⭐⭐⭐⭐⭐ (Meest complex!)

**Tijdsinschatting**: 16-20 uur

---

### 📝 Dag 3: LogViewerTab
**Doel**: Application logs viewer

**Components**:
```
src/app/features/log-viewer/
├── log-viewer.component.ts
└── components/
    └── log-entry/
```

**Service**:
```typescript
src/app/core/services/logger.service.ts
- log(), error(), warn(), info()
- getLogs()
- clearLogs()
```

**Complexiteit**: ⭐⭐

**Tijdsinschatting**: 4 uur

---

### 📝 Dag 4: NictizTab
**Doel**: Nictiz-specific features

**Components**:
```
src/app/features/nictiz/
├── nictiz.component.ts
```

**Complexiteit**: ⭐⭐

**Tijdsinschatting**: 6 uur

---

### 📝 Dag 5: PluriformTab + ResourceInfoTab + TechnicalTab
**Doel**: Resterende kleinere tabs

**Complexiteit**: ⭐⭐ each

**Tijdsinschatting**: 12 uur total

---

## **WEEK 7-8: Dialogs & Advanced Components**

### 📝 Dag 1-2: ResourceEditorDialog
**Doel**: Monaco Editor integration voor resource editing

**Component**:
```
src/app/shared/dialogs/resource-editor/
├── resource-editor-dialog.component.ts
├── components/
│   ├── property-browser/
│   └── validation-panel/
└── services/
    └── monaco-config.service.ts
```

**Library**:
```bash
npm install ngx-monaco-editor
```

**Complexiteit**: ⭐⭐⭐⭐⭐ (Hoogste complexiteit!)

**Tijdsinschatting**: 16-20 uur

---

### 📝 Dag 3: Common Dialogs
**Doel**: Alle andere dialogs

**Components**:
```
src/app/shared/dialogs/
├── settings-dialog/
├── about-dialog/
├── reference-selector-dialog/
└── confirmation-dialog/
```

**Tijdsinschatting**: 8 uur

---

### 📝 Dag 4-5: Authentication Components
**Doel**: Login, 2FA, OAuth2

**Components**:
```
src/app/features/auth/
├── login/
├── two-factor-setup/
└── two-factor-verification/
```

**Services**:
```
src/app/core/services/
├── auth.service.ts (update)
├── totp.service.ts
└── oauth.service.ts
```

**Tijdsinschatting**: 10-12 uur

---

## **WEEK 9-10: Electron Integration**

### 📝 Dag 1-2: Electron IPC Bridge
**Doel**: Angular <-> Electron communicatie

**Files**:
```
electron/
├── main.ts (TypeScript version)
├── preload.ts
└── ipc/
    ├── file-handlers.ts
    ├── settings-handlers.ts
    └── cache-handlers.ts
```

**Angular Service**:
```typescript
src/app/core/services/electron.service.ts
- File operations
- Settings persistence
- Cache management
```

**Tijdsinschatting**: 12 uur

---

### 📝 Dag 3: OAuth2 Callback Server
**Doel**: SMART on FHIR OAuth2 flow

**Files**:
```
electron/auth/
├── oauth-server.ts
├── callback-handler.ts
└── token-manager.ts
```

**Angular Integration**:
- Update AuthService
- OAuth flow components

**Tijdsinschatting**: 10 uur

---

### 📝 Dag 4: File System Operations
**Doel**: File import/export, templates laden

**Electron handlers**:
- openFile()
- saveFile()
- loadTemplates()
- saveTemplates()

**Angular Service**:
```typescript
src/app/core/services/file.service.ts
```

**Tijdsinschatting**: 6 uur

---

### 📝 Dag 5: Settings & Persistence
**Doel**: electron-store integratie

**Installation**:
```bash
npm install electron-store
```

**Implementation**:
- Settings persistence
- Account storage
- Recent servers
- Window state

**Tijdsinschatting**: 6 uur

---

## **WEEK 11: Testing & Quality**

### 📝 Dag 1-2: Unit Tests
**Doel**: Tests voor alle services

**Setup**:
```bash
# Jest (optioneel, Angular default is Jasmine)
npm install --save-dev jest @types/jest
```

**Test Coverage Target**: 60%+

**Prioriteit**:
1. Services (FhirService, AuthService, etc.)
2. Utilities (template processor, validators)
3. Complex components (QueryBuilder, ResourceEditor)

**Tijdsinschatting**: 12-16 uur

---

### 📝 Dag 3: Integration Tests
**Doel**: E2E flows testen

**Tool**: Playwright (recommended)
```bash
npm install --save-dev @playwright/test
```

**Test Scenarios**:
1. Login flow
2. Query execution flow
3. Template creation flow
4. Profile browsing flow

**Tijdsinschatting**: 8 uur

---

### 📝 Dag 4-5: Bug Fixes & Polish
**Doel**: Alle gevonden bugs fixen

**Tasks**:
- Fix alle TypeScript errors
- Fix alle console warnings
- Performance optimalisatie
- Memory leak checks
- Error handling improvements

**Tijdsinschatting**: 12 uur

---

## **WEEK 12: Packaging & Deployment**

### 📝 Dag 1-2: Build Configuration
**Doel**: Production builds optimaliseren

**Tasks**:
1. **Angular Build Optimization**
   ```json
   angular.json:
   - Budgets aanpassen
   - Tree shaking configureren
   - Lazy loading routes
   ```

2. **Electron Builder Configuration**
   ```json
   package.json:
   "build": {
     "appId": "com.fhir.client.v3",
     "productName": "FHIR Client",
     "win": {
       "target": "nsis",
       "icon": "build/icon.ico"
     }
   }
   ```

**Tijdsinschatting**: 8 uur

---

### 📝 Dag 3: Packaging
**Doel**: Installeerbare builds maken

**Platforms**:
- Windows (NSIS installer)
- macOS (DMG) - optional
- Linux (AppImage) - optional

**Tasks**:
- Icons maken
- Splash screen
- About dialog info
- Version numbers

**Tijdsinschatting**: 6-8 uur

---

### 📝 Dag 4-5: Documentation
**Doel**: Complete documentatie

**Files**:
- README.md (update)
- ARCHITECTURE.md (nieuw)
- API.md (services documentation)
- CONTRIBUTING.md (voor toekomstige developers)

**Tijdsinschatting**: 8 uur

---

## **WEEK 13-14: Advanced Features** (Optioneel)

### 📝 Auto-Updates
**Library**:
```bash
npm install electron-updater
```

**Implementation**:
- Update check on startup
- Download progress
- Install & restart

**Tijdsinschatting**: 8 uur

---

### 📝 Advanced Template Features
**Features**:
- Template marketplace
- Import/export templates
- Template versioning
- Shared templates

**Tijdsinschatting**: 12 uur

---

### 📝 Performance Optimizations
**Tasks**:
- Virtual scrolling voor lange lijsten
- Lazy loading voor grote resources
- Worker threads voor heavy operations
- Caching strategies

**Tijdsinschatting**: 10 uur

---

## 📊 Samenvatting Timeline

| Week | Focus | Uren (fulltime) | Deliverable |
|------|-------|-----------------|-------------|
| 1 | Foundation & Services | 40 | Core services werkend |
| 2 | Layout & Navigation | 40 | App shell compleet |
| 3-4 | Main Tabs (Part 1) | 80 | 5 tabs werkend |
| 5-6 | Main Tabs (Part 2) | 80 | Alle 11 tabs werkend |
| 7-8 | Dialogs & Components | 80 | Resource editor + dialogs |
| 9-10 | Electron Integration | 80 | IPC + OAuth2 werkend |
| 11 | Testing & Quality | 40 | Tests + bug fixes |
| 12 | Packaging & Docs | 40 | Installer ready |
| 13-14 | Advanced (Optional) | 80 | Updates + optimalisaties |

**Totaal**: 480-560 uur (12-14 weken fulltime)

---

## 🎯 Prioriteiten & Must-Haves

### ✅ Must-Have (voor release)
1. FhirQueryTab - Core functionaliteit
2. ProfilesTab - Already done!
3. ValidatorTab - Kritisch voor FHIR werk
4. ResourceEditorDialog - Meest gebruikte feature
5. OAuth2 Login - Security
6. Settings Dialog - Configuratie

### 🔶 Should-Have (belangrijk)
7. TerminologyTab
8. PredefinedTab (Templates)
9. FhirPathTab
10. ResourceBrowserTab

### ⭕ Nice-to-Have (later)
11. Auto-updates
12. Advanced template features
13. NictizTab specifics
14. PluriformTab

---

## 🛠️ Development Tips

### Dagelijkse Workflow
```bash
# 1. Start development
cd C:\projects\fhir-client-v3
npm run electron:dev

# 2. Work on feature in parallel terminal
ng generate component features/new-feature

# 3. Build test
npm run build

# 4. Commit progress
git add .
git commit -m "feat: add new feature"
```

### Testing Strategy
- Test elke tab direct na completion
- Gebruik HAPI FHIR test server: https://hapi.fhir.org/baseR4
- Cross-check met React v2 voor feature parity

### Code Quality
- TypeScript strict mode blijft aan
- Signals voor state (geen classes tenzij nodig)
- RxJS voor async operations
- Angular style guide volgen

---

## 📝 Checklist per Feature

Voor elke nieuwe feature:

- [ ] Component aangemaakt
- [ ] Service aangemaakt (indien nodig)
- [ ] Models gedefinieerd
- [ ] Template gebouwd
- [ ] Styles toegevoegd
- [ ] RxJS subscriptions cleanup (ngOnDestroy)
- [ ] Error handling geïmplementeerd
- [ ] Loading states toegevoegd
- [ ] Build succesvol
- [ ] Manueel getest
- [ ] Gecommit naar git

---

## 🚀 Quick Start

**Om vandaag te beginnen:**

```bash
cd C:\projects\fhir-client-v3

# Maak eerste nieuwe feature (bijv. FhirQueryTab)
ng generate component features/fhir-query

# Maak bijbehorende service
ng generate service core/services/query-builder

# Start development server
npm run electron:dev
```

---

## 📞 Hulp Nodig?

Bij problemen tijdens migratie:
1. Check ARCHITECTURE.md (maak ik later)
2. Vergelijk met ProfilesTab POC (working example)
3. Check Angular docs: https://angular.dev
4. RxJS docs: https://rxjs.dev

---

**Succes met de migratie!** 🎉

_Gemaakt op: 2026-01-06_
_Status: Ready to execute_
