# Multi-Server Profile Feature - Voortgang & Bevindingen

**Datum:** 15 januari 2026
**Branch:** master (nog te committen)
**Status:** Basis functionaliteit werkend, fine-tuning nodig

---

## Wat is geïmplementeerd

### 1. ServerProfile Model (`src/app/core/models/server-profile.model.ts`)
- Nieuw model ter vervanging van `SavedAccount`
- Ondersteunt 5 authenticatie types:
  - `none` - Open servers (geen auth)
  - `basic` - Username/password (Base64)
  - `bearer` - Static API token
  - `oauth2` - OAuth2 Client Credentials flow
  - `mtls` - Mutual TLS met client certificaat
- Bevat: id, name, fhirServerUrl, authType, authConfig, color, isDefault, lastUsed

### 2. ServerProfileService (`src/app/core/services/server-profile.service.ts`)
- CRUD operaties voor profiles
- Session management per profile
- Auth headers generatie per auth type
- Migratie van oude SavedAccounts naar nieuwe ServerProfiles
- Signals: `profiles`, `activeProfileId`, `activeProfile`, `sessions`
- Auto-select eerste/default profile bij startup

### 3. Electron Storage (`electron/auth/token-store.js`)
- Nieuwe encrypted stores voor profiles en sessions
- Methodes: `getProfiles()`, `setProfiles()`, `getSession()`, `setSession()`, etc.
- Backwards compatible met bestaande token storage

### 4. IPC Handlers (`electron/auth/auth-handler.js`)
- `profiles:getAll`, `profiles:save`
- `profiles:getActive`, `profiles:setActive`
- `session:get`, `session:set`, `session:clear`

### 5. Preload Bridge (`electron/preload.js`)
- `window.electronAPI.profiles.*`
- `window.electronAPI.session.*`

### 6. Server Selector Component (`src/app/shared/components/server-selector/`)
- Dropdown in header voor snel wisselen tussen servers
- Toont huidige server met kleur indicator
- Gevulde dot (●) = actieve sessie, lege dot (○) = geen sessie
- Quick actions: "Server toevoegen", "Servers beheren"
- Dark mode support

### 7. Server Profile Dialog (`src/app/shared/components/server-profile-dialog/`)
- Dialog voor toevoegen/bewerken van server profiles
- Dynamische form velden per auth type
- Kleur picker met voorgedefinieerde kleuren
- Test connection functionaliteit
- Certificate dropdown voor mTLS (uit certificate manager)

### 8. Header Integratie (`src/app/layout/header/`)
- Server selector toegevoegd naast logo
- Event handlers voor add/manage profiles

### 9. FhirService Updates (`src/app/core/services/fhir.service.ts`)
- Dynamische FHIR server URL op basis van actief profile
- Auth headers per request op basis van profile auth type

---

## Opgeloste Problemen

### Dropdown niet zichtbaar (CSS conflict)
- **Probleem:** Bootstrap's `.dropdown-menu` heeft default `display: none`
- **Oplossing:** `display: block` toegevoegd aan onze dropdown-menu styles
- **Bestanden:**
  - `server-selector.component.scss` (regel 58)
  - `header.component.scss` (regel 170)

### ViewEncapsulation blocking styles
- **Probleem:** Angular's default encapsulation blokkeerde global styles
- **Oplossing:** `ViewEncapsulation.None` toegevoegd aan ServerSelectorComponent

### Line-height inheritance
- **Probleem:** Header's `line-height: 54px` werd overgeërfd door dropdown
- **Oplossing:** `line-height: normal` resets in header styles

### Overflow hidden
- **Probleem:** Dropdown werd afgesneden door parent containers
- **Oplossing:** `overflow: visible` toegevoegd aan `.app-header` en `.header-left`

---

## Te fine-tunen / TODO's voor morgen

### Hoge Prioriteit
1. **Test alle auth types**
   - [ ] none: HAPI public server
   - [ ] basic: server met username/password
   - [ ] bearer: server met static token
   - [ ] oauth2: Keycloak/Azure AD
   - [ ] mtls: server met client certificate

2. **Migratie testen**
   - [ ] Verify oude SavedAccounts correct migreren naar ServerProfiles
   - [ ] Check of tokens behouden blijven

3. **Session persistence**
   - [ ] Verify sessions correct opgeslagen worden in Electron store
   - [ ] Test token refresh voor OAuth2

### Medium Prioriteit
4. **UI/UX verbeteringen**
   - [ ] Loading state bij server switch
   - [ ] Error handling bij connectie problemen
   - [ ] Confirmation dialog bij verwijderen server
   - [ ] Betere feedback bij test connection

5. **Dark mode**
   - [ ] Verify alle dropdown elementen correct in dark mode
   - [ ] Check profile dialog dark mode styling

6. **Form validatie**
   - [ ] Required field validatie in profile dialog
   - [ ] URL format validatie voor FHIR server URL
   - [ ] Token endpoint validatie voor OAuth2

### Lage Prioriteit
7. **Code cleanup**
   - [ ] Console.log statements verwijderen (meeste al gedaan)
   - [ ] Unused imports verwijderen
   - [ ] ESLint warnings fixen

8. **Settings integratie**
   - [ ] Servers tab in settings dialog
   - [ ] Bulk import/export van profiles

---

## Gewijzigde Bestanden

### Nieuwe bestanden
```
src/app/core/models/server-profile.model.ts
src/app/core/services/server-profile.service.ts
src/app/shared/components/server-selector/server-selector.component.ts
src/app/shared/components/server-selector/server-selector.component.html
src/app/shared/components/server-selector/server-selector.component.scss
src/app/shared/components/server-profile-dialog/server-profile-dialog.component.ts
src/app/shared/components/server-profile-dialog/server-profile-dialog.component.html
src/app/shared/components/server-profile-dialog/server-profile-dialog.component.scss
```

### Gewijzigde bestanden
```
electron/auth/token-store.js
electron/auth/auth-handler.js
electron/preload.js
src/app/core/services/fhir.service.ts
src/app/core/services/auth.service.ts
src/app/layout/header/header.component.ts
src/app/layout/header/header.component.html
src/app/layout/header/header.component.scss
src/types/electron.d.ts
```

---

## Test Commando's

```bash
# Build
npm run build

# Lint
npm run lint

# Start Electron
npm run electron:dev

# Of Angular dev server
npm start
```

---

## Architectuur Notities

### Data Flow
```
User clicks server → ServerSelectorComponent
                          ↓
                   ServerProfileService.switchToProfile()
                          ↓
                   Electron IPC (profiles:setActive)
                          ↓
                   token-store.js (persist)
                          ↓
                   FhirService gets new activeProfile
                          ↓
                   All FHIR requests use new server + auth
```

### Auth Headers per Type
| Type | Header |
|------|--------|
| none | (geen) |
| basic | `Authorization: Basic base64(user:pass)` |
| bearer | `Authorization: Bearer <token>` |
| oauth2 | `Authorization: Bearer <access_token>` |
| mtls | (handled at transport level) |

---

## Bekende Beperkingen

1. **mTLS:** Vereist Electron - werkt niet in browser
2. **OAuth2 refresh:** Token refresh nog niet geïmplementeerd
3. **Browser mode:** Profiles worden niet persistent opgeslagen in browser (alleen Electron)

---

## Git Status

Uncommitted changes op master branch. Overweeg een feature branch aan te maken voordat je verder gaat:

```bash
git checkout -b feature/multi-server-profiles
git add .
git commit -m "feat: add multi-server profile support with 5 auth types"
```
