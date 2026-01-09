# FHIR Client v3

> A modern, feature-rich FHIR (Fast Healthcare Interoperability Resources) client application built with Angular 18 and Electron.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/angular-18-red.svg)](https://angular.io)
[![Electron](https://img.shields.io/badge/electron-latest-47848f.svg)](https://electronjs.org)

FHIR Client v3 is a professional desktop application for healthcare developers and FHIR enthusiasts. It provides a comprehensive suite of tools for querying, validating, and exploring FHIR resources from any FHIR-compliant server.

## ✨ Features

### 🔍 FHIR Query Builder
- **Visual Query Builder**: Build complex FHIR queries with an intuitive interface
- **Text Mode**: Direct query string input for power users
- **Search Parameters**: Full support for FHIR search parameters, includes, and reverse includes
- **Query History**: Save and manage favorite queries
- **Pagination**: Navigate through large result sets with ease

### 📋 Predefined Templates
- **Smart Query Templates**: Pre-built queries for common FHIR operations
- **Customizable Parameters**: Configure templates with dynamic parameters
- **Template Library**: Browse and execute curated query templates
- **Export/Import**: Share templates with your team

### 📚 Terminology Services
- **CodeSystem Lookup**: Search and explore FHIR CodeSystems
- **ValueSet Expansion**: Expand ValueSets to view all codes
- **Code Validation**: Validate codes against CodeSystems
- **SNOMED CT Support**: Full support for SNOMED CT and other terminologies

### ✅ Resource Validator
- **Schema Validation**: Validate FHIR resources against base FHIR schemas
- **Profile Validation**: Validate against StructureDefinitions and Implementation Guides
- **Real-time Feedback**: Instant validation results with detailed error messages
- **Issue Highlighting**: Visual indicators for validation issues

### 📖 Profiles & StructureDefinitions
- **Profile Browser**: Explore FHIR StructureDefinitions from any server
- **Element Inspector**: Detailed view of profile elements with cardinality and types
- **Snapshot View**: View differential and snapshot representations
- **Search & Filter**: Quickly find profiles by name or canonical URL

### 🏥 Nictiz Profiles
- **Dutch Healthcare Profiles**: Specialized support for Nictiz/MedMij profiles
- **Profile Cache**: Offline access to cached profiles
- **Resource Editor**: Create and edit FHIR resources based on Nictiz profiles
- **Context-Aware Autocomplete**: Smart suggestions based on profile definitions

### 🔗 FHIRPath Evaluator
- **FHIRPath Expressions**: Evaluate FHIRPath expressions on FHIR resources
- **Live Evaluation**: Real-time results as you type
- **Expression History**: Save frequently used FHIRPath expressions
- **Syntax Highlighting**: Clear visualization of expressions

### ℹ️ Resource Info
- **Server Metadata**: View FHIR server capabilities via CapabilityStatement
- **Search Parameters**: Explore available search parameters per resource type
- **Includes & Reverse Includes**: Discover supported _include and _revInclude parameters
- **Alphabetical Sorting**: Organized display of all available options

### 📊 Logs Viewer
- **Real-time Logs**: View application logs in real-time
- **Log Levels**: Filter by debug, info, warn, and error levels
- **Search & Filter**: Quickly find specific log entries
- **Export Logs**: Save logs for debugging or sharing

### 🎨 User Experience
- **Dark Mode**: Easy on the eyes with full dark mode support
- **Responsive Layout**: Adaptive interface that works on different screen sizes
- **Customizable Tabs**: Show/hide tabs based on your workflow
- **Keyboard Shortcuts**: Efficient navigation with keyboard shortcuts

### 🔐 Authentication & Security
- **OAuth2/SMART on FHIR**: Secure authentication via OAuth2
- **Multiple Environments**: Switch between development, test, and production servers
- **Token Management**: Automatic token refresh and secure storage
- **2FA Support**: Two-factor authentication for enhanced security

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 22 or higher ([Download](https://nodejs.org))
- **npm**: Comes with Node.js
- **Git**: For cloning the repository

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/martijn-on-fhir/fhir-client-v3.git
   cd fhir-client-v3
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run electron:dev
   ```

   This will start both the Angular dev server and Electron with hot-reload enabled.

### Available Scripts

```bash
# Development
npm start                  # Start Angular dev server only (web mode)
npm run electron:dev       # Start Electron app with hot-reload

# Building
npm run build             # Build Angular app for production
npm run electron:build    # Build Electron app for distribution

# Testing
npm test                  # Run unit tests
npm run test:watch        # Run tests in watch mode

# Linting & Formatting
npm run lint              # Run ESLint
npm run format            # Format code with Prettier
```

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Angular 18 (Standalone Components, Signals)
- **Desktop**: Electron (Latest version)
- **State Management**: Angular Signals
- **Async Operations**: RxJS Observables
- **Styling**: Bootstrap 5 + SCSS
- **Icons**: Font Awesome 6
- **HTTP Client**: Angular HttpClient with interceptors

### Project Structure

```
fhir-client-v3/
├── src/
│   ├── app/
│   │   ├── core/                    # Core services and models
│   │   │   ├── services/            # Singleton services
│   │   │   │   ├── fhir.service.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── settings.service.ts
│   │   │   │   └── logger.service.ts
│   │   │   ├── models/              # Type definitions
│   │   │   ├── guards/              # Route guards
│   │   │   └── interceptors/        # HTTP interceptors
│   │   ├── features/                # Feature modules
│   │   │   ├── query/               # FHIR Query tab
│   │   │   ├── predefined/          # Templates tab
│   │   │   ├── terminology/         # Terminology tab
│   │   │   ├── validator/           # Validator tab
│   │   │   ├── profiles/            # Profiles tab
│   │   │   ├── nictiz/              # Nictiz tab
│   │   │   ├── fhirpath/            # FHIRPath tab
│   │   │   ├── resource-info/       # Resource Info tab
│   │   │   └── logs/                # Logs tab
│   │   ├── layout/                  # Layout components
│   │   │   ├── header/
│   │   │   ├── sidebar/
│   │   │   └── tab-nav/
│   │   └── shared/                  # Shared components
│   │       ├── components/
│   │       └── dialogs/
│   ├── assets/                      # Static assets
│   └── styles/                      # Global styles
├── electron/
│   ├── main.ts                      # Electron main process
│   ├── preload.ts                   # Preload script
│   └── ipc/                         # IPC handlers
├── .github/
│   └── workflows/                   # CI/CD workflows
└── docs/                            # Documentation

```

### Key Design Patterns

- **Dependency Injection**: All services use Angular's DI system
- **Reactive Programming**: RxJS Observables for async operations
- **Signal-based State**: Modern state management with Angular Signals
- **Standalone Components**: Module-free architecture
- **IPC Communication**: Electron IPC for OAuth and file operations

## 🔧 Development

### Development Workflow

1. **Create a new feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, typed TypeScript code
   - Follow Angular style guide
   - Add unit tests for new features

3. **Test your changes**
   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add new feature"
   ```

   Commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

5. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with Angular rules
- **Prettier**: Auto-formatting on save
- **Naming Conventions**:
  - Components: `kebab-case.component.ts`
  - Services: `kebab-case.service.ts`
  - Models: `kebab-case.model.ts`

### Adding a New Tab

1. Generate the component:
   ```bash
   ng generate component features/your-tab
   ```

2. Add the tab to `src/app/core/models/tab.model.ts`:
   ```typescript
   {
     id: 'your-tab',
     label: 'Your Tab',
     icon: 'your-icon',
     route: '/app/your-tab',
     active: true
   }
   ```

3. Add the route to `src/app/app.routes.ts`

4. Update default enabled tabs in `src/app/core/models/settings.model.ts`

## 📦 Building & Distribution

### Build for Production

```bash
# Build Angular app
npm run build

# Package Electron app
npm run electron:build
```

The packaged application will be available in the `dist/` directory.

### Supported Platforms

- ✅ Windows (64-bit)
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (64-bit)

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Ensure all tests pass
6. Submit a pull request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **FHIR**: Built on the HL7 FHIR standard
- **Angular Team**: For the amazing Angular framework
- **Electron Team**: For making desktop apps with web technologies possible
- **Bootstrap Team**: For the responsive UI framework
- **Community**: Thanks to all contributors and users

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/martijn-on-fhir/fhir-client-v3/issues)
- **Discussions**: [GitHub Discussions](https://github.com/martijn-on-fhir/fhir-client-v3/discussions)
- **Email**: [Support Email](mailto:support@example.com)

## 🗺️ Roadmap

- [ ] Advanced query builder with join support
- [ ] Bulk data export (FHIR Bulk Data API)
- [ ] GraphQL support
- [ ] Plugin system for custom extensions
- [ ] Multi-language support (i18n)
- [ ] Advanced analytics and reporting
- [ ] Subscriptions management
- [ ] Task/Workflow management

---

**Made with ❤️ by healthcare developers, for healthcare developers**

