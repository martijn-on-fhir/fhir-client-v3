# FHIR Client v3 - Angular Proof of Concept

Een moderne Angular 18+ implementatie van de FHIR Client, gebouwd als proof-of-concept om de voordelen van Angular ten opzichte van React te demonstreren.

## 🎯 Waarom Angular?

### Voordelen ten opzichte van React (v2):

1. **TypeScript-First**: Betere type safety voor complexe FHIR types
2. **Signals**: Moderne, performante state management (geen hooks rompslomp!)
3. **RxJS Observables**: Perfect voor async FHIR operations
4. **Dependency Injection**: Cleaner service architecture
5. **Standalone Components**: Moderne, module-vrije architectuur

## 📁 Project Structuur

```
src/app/
├── core/                    # Singleton services en models
│   ├── services/
│   │   └── fhir.service.ts # FHIR service met RxJS
│   └── models/
│       └── profile.model.ts # Type-safe FHIR models
├── features/                # Feature modules
│   └── profiles/           # ProfilesTab POC
└── shared/                  # Gedeelde components (later)

electron/
├── main.js                  # Electron main process
└── preload.js               # Preload script
```

## 🚀 Getting Started

```bash
# Dependencies installeren
npm install

# Angular dev server starten (alleen web)
npm start

# Electron app starten (development met auto-reload)
npm run electron:dev

# Production build maken
npm run electron:build
```

## 🎨 Features Geïmplementeerd

### ✅ ProfilesTab (POC)

- FHIR metadata ophalen van server
- Profiles browser met dropdown
- StructureDefinition laden (met fallback strategies)
- Elements weergeven (required/optional)
- RxJS voor alle async operations
- Angular Signals voor state management

## 📊 React vs Angular Vergelijking

| Feature | React v2 | Angular v3 |
|---------|----------|-----------|
| State Management | useState + Zustand | Signals (built-in) |
| Async Handling | Promises | RxJS Observables |
| DI | Context + hooks | Native DI |
| Type Safety | 7/10 | 9/10 |

### Code Vergelijking

**React (verbose):**
```typescript
const [loading, setLoading] = useState(false);
useEffect(() => { ... }, [dep1, dep2]);
```

**Angular (clean):**
```typescript
loading = signal(false);
// No useEffect - use RxJS!
```

## 📝 Volgende Stappen

**Geschatte tijd volledige migratie**: 10-14 weken fulltime

---

**Ontwikkeld met** ❤️ **en Angular 18+**
