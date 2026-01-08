# FHIR Client v2 → v3 Migration Status

**Last Updated**: January 6, 2026
**Source**: `C:\projects\fhir-client-v2` (React + Electron)
**Target**: `C:\projects\fhir-client-v3` (Angular + Electron)

---

## 🎉 Today's Progress (January 6, 2026)

### ✅ Critical CORS Issues Resolved

#### 1. Authentication Service Fixed
**Problem**: Angular's `HttpClient` was making OAuth requests directly from the browser, causing CORS errors when authenticating with Keycloak.

**Solution Implemented**:
- ✅ Updated `src/app/core/services/auth.service.ts` to use Electron IPC instead of `HttpClient`
- ✅ Authentication now happens in Electron's main process (Node.js context) - no CORS restrictions
- ✅ Removed browser-based OAuth flow completely

**Architecture Change**:
```
BEFORE: Angular HttpClient → Browser → ❌ CORS blocked by Keycloak
AFTER:  Angular → Electron IPC → Main Process axios → ✅ Success
```

**Files Modified**:
- `src/app/core/services/auth.service.ts` - Changed from HttpClient to IPC

#### 2. Terminology Service Fixed
**Problem**: Terminology server requires OAuth2 authentication. Angular's `HttpClient` was hitting CORS restrictions when acquiring tokens, resulting in 401 Unauthorized errors.

**Solution Implemented**:
- ✅ Created `electron/terminology/terminology-handler.js` - IPC handler for terminology operations
- ✅ Registered handlers in `electron/main.js`
- ✅ Exposed API in `electron/preload.js`
- ✅ Completely rewrote `src/app/core/services/terminology.service.ts` to use Electron IPC
- ✅ OAuth2 password grant authentication now handled automatically in main process
- ✅ Token auto-refresh with 60-second buffer (15-minute token lifetime)

**Files Created**:
- `electron/terminology/terminology-handler.js`

**Files Modified**:
- `electron/main.js` - Registered terminology handlers
- `electron/preload.js` - Exposed terminology API
- `src/app/core/services/terminology.service.ts` - Complete rewrite (~329 lines → ~160 lines)

**Test Results**:
```
✅ [TerminologyHandler] Terminology IPC handlers registered successfully
✅ [TerminologyHandler] OAuth2 token acquired successfully, expires in 900 seconds
✅ Lookup query for SNOMED code 73211009 successful (no more 401 errors!)
```

#### 3. FHIR Server Configuration Fixed
**Problem**: Fallback FHIR server URL was pointing to HAPI test server instead of Adapcare.

**Solution**:
- ✅ Updated `src/app/core/services/fhir.service.ts` fallback URL
- ✅ Changed from `https://hapi.fhir.org/baseR4` to `https://fhir-adapcare.dev.carebeat-connector.nl`

**Files Modified**:
- `src/app/core/services/fhir.service.ts:45`

---

## 🏗️ Architecture Pattern Established

### Electron IPC Pattern for External APIs
All external API calls that require OAuth or face CORS restrictions should follow this pattern:

**Pattern**:
1. **Electron Handler** (`electron/[service]/[service]-handler.js`)
   - Makes actual HTTP requests using `axios` or `fetch`
   - Handles OAuth2 token management
   - Implements retry logic for 401 errors

2. **Preload Script** (`electron/preload.js`)
   - Exposes IPC methods via `contextBridge.exposeInMainWorld()`
   - Provides type-safe API surface to renderer

3. **Angular Service** (`src/app/core/services/[service].service.ts`)
   - Calls `window.electronAPI.[service].[method]()`
   - Provides reactive state management using Angular signals
   - Handles UI state (loading, error messages)

**Services Using This Pattern**:
- ✅ **AuthService** - OAuth2 client credentials flow with Keycloak
- ✅ **TerminologyService** - OAuth2 password grant with Nictiz terminology server
- 🔄 **FhirService** - TODO: May need IPC if FHIR server requires special auth

---

## 📊 Migration Progress Overview

### Core Infrastructure
| Component | Status | Notes |
|-----------|--------|-------|
| Angular 18 Project | ✅ Complete | Working setup |
| Electron Integration | ✅ Complete | IPC handlers working |
| Bootstrap + FontAwesome | ✅ Complete | Styling ready |
| Auth Service (IPC-based) | ✅ Complete | CORS issue fixed |
| Terminology Service (IPC-based) | ✅ Complete | OAuth working |
| FHIR Service | 🔄 In Progress | Basic structure exists |
| Theme Service | ⏳ Pending | To be migrated |
| Settings Service | ⏳ Pending | To be migrated |

### Environment Configuration
| Environment | FHIR Server | Keycloak Server | Status |
|-------------|-------------|-----------------|--------|
| Development | `https://fhir-adapcare.dev.carebeat-connector.nl` | `https://keycloak.dev.carebeat-connector.nl` | ✅ Working |
| Acceptance | `https://fhir.acc.carebeat-connector.nl/fhir` | `https://keycloak.acc.carebeat-connector.nl` | ✅ Configured |
| Production | `https://fhir.carebeat-connector.nl/fhir` | `https://keycloak.carebeat-connector.nl` | ✅ Configured |
| Local | `http://localhost:8080/fhir` | `http://localhost:8081` | ✅ Configured |

### Features & Components
| Feature | v2 (React) | v3 (Angular) | Status |
|---------|-----------|-------------|--------|
| Login Screen | ✅ | ✅ | Complete with 2FA support |
| Profile Management | ✅ | ✅ | POC working |
| Resource Editor | ✅ | ⏳ | Not started |
| Terminology Lookup | ✅ | ✅ | Working (CORS fixed!) |
| Predefined Templates | ✅ | ⏳ | Not started |
| Visual Query Builder | ✅ | ⏳ | Not started |
| File Operations | ✅ | ⏳ | IPC handlers needed |
| Settings Dialog | ✅ | ⏳ | Not started |
| 2FA Setup | ✅ | ⏳ | Backend ready, UI pending |

---

## 🚧 Known Issues & Technical Debt

### Current Issues
1. ✅ ~~CORS errors on authentication~~ - **FIXED TODAY**
2. ✅ ~~CORS/401 errors on terminology lookup~~ - **FIXED TODAY**
3. ✅ ~~FHIR server fallback pointing to HAPI~~ - **FIXED TODAY**

### Remaining Challenges
1. **FHIR Service Authentication** - Needs review to ensure it uses proper auth headers
2. **File System Operations** - Need IPC handlers for save/load operations
3. **Template System** - Complex feature requiring significant migration effort
4. **Auto-Updates** - Electron auto-updater integration pending

---

## 📝 Tomorrow's Priorities

### High Priority (Must Do)
1. **Test Current Implementation**
   - ✅ Login flow working end-to-end?
   - ✅ Terminology lookup working?
   - 🔄 Profile loading working?
   - 🔄 Can we make FHIR queries?

2. **FHIR Service Enhancement**
   - Review authentication mechanism
   - Implement proper error handling
   - Add HTTP interceptor for auth tokens
   - Test against Adapcare FHIR server

3. **File Operations IPC**
   - Create `electron/file/file-handler.js`
   - Implement open/save file dialogs
   - Expose to Angular via preload

### Medium Priority (Should Do)
4. **Settings Service**
   - Migrate settings storage from v2
   - Implement using Electron Store
   - Create settings dialog UI

5. **Theme Service**
   - Implement dark/light mode toggle
   - Persist theme preference
   - Apply theme on startup

### Lower Priority (Nice to Have)
6. **Component Migration Planning**
   - Review v2 components
   - Plan Angular component structure
   - Create reusable component library

---

## 🔑 Key Architectural Decisions

### 1. Signals Over RxJS (Where Possible)
- Using Angular Signals for reactive state management
- Simpler, more performant than RxJS observables
- Better IDE support and type safety

### 2. Electron IPC for External APIs
- All OAuth-protected APIs use Electron IPC
- Bypasses CORS completely
- Keeps credentials in main process (more secure)
- Automatic token management

### 3. Standalone Components
- Using Angular standalone components (no NgModules)
- Cleaner, more tree-shakeable
- Better for code splitting

### 4. TypeScript Strict Mode
- Full type safety
- Catches errors at compile time
- Better IDE autocomplete

---

## 📚 Reference: v2 vs v3 Service Mapping

| v2 Service (React) | v3 Service (Angular) | Implementation |
|-------------------|---------------------|----------------|
| `auth-store.ts` | `auth.service.ts` | ✅ IPC-based, working |
| `terminology-service.ts` | `terminology.service.ts` | ✅ IPC-based, working |
| `fhir-service.ts` | `fhir.service.ts` | 🔄 Partially migrated |
| `theme-store.ts` | `theme.service.ts` | ⏳ Pending |
| `ui-settings-store.ts` | `settings.service.ts` | ⏳ Pending |
| `totp-service.ts` | `totp.service.ts` | ✅ Complete (v3) |
| `controller-service.ts` | Not needed | Angular handles this |

---

## 🧪 Testing Checklist

### Manual Testing (Do Tomorrow)
- [ ] Login with client credentials
- [ ] Login with 2FA enabled
- [ ] Terminology lookup (SNOMED code)
- [ ] ValueSet expansion
- [ ] Profile loading from FHIR server
- [ ] Theme toggle (when implemented)
- [ ] Settings persistence (when implemented)
- [ ] File save/load (when implemented)

### Automated Testing (Future)
- [ ] Unit tests for services
- [ ] Component tests
- [ ] E2E tests with Playwright
- [ ] Integration tests for Electron IPC

---

## 📁 Project Structure Reference

```
C:\projects\fhir-client-v3\
├── electron/
│   ├── auth/
│   │   ├── auth-handler.js      ✅ OAuth2 + IPC
│   │   └── token-store.js       ✅ Encrypted storage
│   ├── terminology/
│   │   └── terminology-handler.js  ✅ OAuth2 + IPC (NEW!)
│   ├── main.js                  ✅ Main process entry
│   └── preload.js              ✅ IPC API exposure
│
├── src/app/
│   ├── core/
│   │   ├── config/
│   │   │   └── environments.ts  ✅ Environment configs
│   │   ├── models/
│   │   │   ├── auth.model.ts    ✅ Auth types
│   │   │   └── ...
│   │   └── services/
│   │       ├── auth.service.ts      ✅ IPC-based auth
│   │       ├── fhir.service.ts      🔄 Partial
│   │       ├── terminology.service.ts  ✅ IPC-based
│   │       └── totp.service.ts      ✅ 2FA
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── login/              ✅ Complete
│   │   │   └── 2fa-verification/   ✅ Complete
│   │   └── profiles/
│   │       └── profiles-tab/       ✅ POC working
│   │
│   └── shared/
│       └── components/             ⏳ To be created
│
└── package.json                    ✅ Dependencies ready
```

---

## 💡 Lessons Learned

### What Went Well
1. **Electron IPC Pattern** - Clean separation of concerns, excellent for bypassing CORS
2. **Angular Signals** - Much simpler than RxJS for most state management
3. **Incremental Migration** - Starting with POC (ProfilesTab) helped validate architecture
4. **TypeScript** - Caught many issues early during migration

### What to Avoid
1. **Don't** try to make HTTP requests from Angular to OAuth-protected APIs (CORS nightmare)
2. **Don't** mix RxJS and Signals unnecessarily (pick one pattern)
3. **Don't** migrate everything at once (incremental is better)
4. **Don't** skip IPC handlers for privileged operations (security risk)

### Best Practices
1. **Always** use Electron IPC for external APIs requiring authentication
2. **Always** handle token refresh in the main process
3. **Always** validate environment configuration on startup
4. **Always** log IPC operations for debugging

---

## 🔗 Related Documentation

- [Angular 18 Documentation](https://angular.dev)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [Nictiz Terminology Server](https://terminologieserver.nl)
- [Original Migration Plan](./MIGRATION_PLAN.md)

---

## 📞 Questions for Tomorrow

1. Do we need to implement profile caching in Angular like v2?
2. Should we migrate the template system next, or focus on core CRUD operations first?
3. What's the priority: missing features vs. feature parity with v2?
4. Do we need the Visual Query Builder immediately, or can it wait?

---

**Status**: 🟢 **Green - Good Progress**
**Next Session**: Continue with FHIR service enhancement and file operations
