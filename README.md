# FHIR Client

A modern desktop application for exploring, querying, and validating FHIR resources.

![Angular](https://img.shields.io/badge/Angular-18-red?logo=angular)
![Electron](https://img.shields.io/badge/Electron-39-47848f?logo=electron)
![License](https://img.shields.io/badge/License-Private-orange)

## About

FHIR Client is a powerful desktop application designed for healthcare developers, integration specialists, and anyone working with FHIR (Fast Healthcare Interoperability Resources) servers. It provides an intuitive interface for querying FHIR servers, validating resources, exploring terminology, and much more.

### Key Highlights

- **Multi-server support** - Connect to multiple FHIR servers with different authentication methods
- **Smart autocomplete** - Context-aware suggestions for resource types, search parameters, and modifiers
- **Dark mode** - Full dark theme support for comfortable viewing
- **Offline capable** - Cached profiles and terminology for offline work
- **Cross-platform** - Available for Windows, macOS, and Linux

## Features

### Query Builder

Build and execute FHIR queries with ease using the visual query builder or text mode for power users.

- Visual parameter builder with dropdowns for resource types and search parameters
- Full support for `_include`, `_revinclude`, and chained search parameters
- Smart autocomplete with context-aware suggestions
- Query history and favorites
- Pagination controls for navigating large result sets
- Copy queries to clipboard or export results
- Query validation with detailed error messages

### Predefined Templates

Save time with pre-built query templates for common FHIR operations.

- Library of curated query templates
- Customizable parameters with smart defaults
- Create, edit, import and export your own templates
- Category-based organization

### Terminology Services

Explore and validate medical terminologies.

- **CodeSystem Lookup** - Search codes within any CodeSystem
- **ValueSet Expansion** - Expand ValueSets to see all included codes
- **Code Validation** - Validate codes against CodeSystems or ValueSets
- Full support for SNOMED CT, LOINC, and other terminologies
- Ctrl+click on terminology URLs to perform quick lookups

### Resource Validator

Validate FHIR resources against schemas and profiles.

- Schema validation against base FHIR specification
- Profile validation against StructureDefinitions
- Real-time validation feedback
- Detailed error messages with line numbers
- Supports JSON and XML formats

### Resource Editor

Edit FHIR resources with profile-aware guidance.

- Create new resources from StructureDefinition profiles
- Edit existing resources with element guidance
- Profile-based autocomplete and validation
- Generate narrative text from Handlebars templates
- Automatic profile loading based on `meta.profile`

### Narrative Generator

Generate human-readable narratives for FHIR resources.

- Handlebars template-based narrative generation
- Built-in templates for common resource types
- Custom template editor with Monaco
- Preview generated HTML narratives
- Insert narratives directly into resources

### Profile Browser

Explore FHIR StructureDefinitions and profiles.

- Browse profiles from any FHIR server
- View element definitions with cardinality, types, and constraints
- Snapshot and differential views
- Search and filter by name or canonical URL
- Ctrl+click on canonical URLs to navigate to StructureDefinitions

### Nictiz Profiles (Dutch Healthcare)

Specialized support for Dutch healthcare profiles.

- Pre-loaded Nictiz/MedMij profiles
- Create new resources based on profile definitions
- Context-aware autocomplete based on profile constraints
- Offline profile cache

### FHIRPath Evaluator

Evaluate FHIRPath expressions on FHIR resources.

- **Smart autocomplete** - Context-aware suggestions based on your JSON data
  - Property suggestions from the actual JSON structure
  - FHIRPath function suggestions with signatures (where, ofType, first, exists, etc.)
  - Resource type suggestions inside `ofType()`
  - Element property suggestions inside `where()` filters
- Keyboard navigation for autocomplete (arrows, Tab, Enter, Escape)
- Load resources from files or paste JSON directly
- Syntax highlighting with Monaco editor
- Split-panel layout with resizable editor and result sections

### Reference Graph

Visualize relationships between FHIR resources in an interactive network graph.

- **Interactive visualization** - Explore resource references as a visual network
- **Forward references** - See all resources that a resource references
- **Reverse references** - Discover resources that reference your target resource
- **Configurable depth** - Control how many levels of references to traverse (1-5)
- **Double-click to expand** - Explore nodes deeper by double-clicking
- **Resource details** - Click nodes to view full resource JSON
- **Quick navigation** - Jump directly to Query tab to explore a resource
- **Visual differentiation** - Different colors for resource types, dashed lines for reverse references
- **Root node highlighting** - Easily identify the starting resource with distinct border

### Resource Diff Viewer

Compare FHIR resources side-by-side with visual diff highlighting.

- **Compare History** - Compare different versions of the same resource
  - Auto-load resource history from FHIR server
  - Select any two versions to compare
  - See version timestamps and IDs
- **Compare Resources** - Compare two different resources
  - Fetch resources by reference
  - Paste JSON directly
  - Swap left and right sides
- **Visual diff** - Monaco-powered diff editor with:
  - Side-by-side or inline view modes
  - Addition/deletion highlighting
  - Diff statistics (additions, deletions)
- **Full-screen dialog** - Maximum space for comparing large resources

### Subscription Management

Manage FHIR STU3 subscriptions for real-time notifications.

- View and manage active subscriptions
- Create new subscriptions with channel configuration
- Monitor subscription status
- Support for REST-hook channels

### Server Information

View detailed information about connected FHIR servers.

- CapabilityStatement viewer
- Available search parameters per resource type
- Supported includes and reverse includes

### Certificate Manager

Manage client certificates for mTLS authentication.

- Import PFX/P12 certificates
- Certificate validation and details view
- Secure certificate storage
- Per-server certificate assignment

### Application Logs

Monitor application activity and debug issues.

- Real-time log viewer
- Filter by log level (debug, info, warn, error)
- Search through log entries
- Export logs for troubleshooting

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/martijn-on-fhir/fhir-client-v3/releases) page:

- **Windows**: `.exe` installer or portable `.zip`
- **macOS**: `.dmg` installer
- **Linux**: `.AppImage` or `.deb` package

### Build from Source

Requirements:
- Node.js 22 or higher
- npm (comes with Node.js)

```bash
# Clone the repository
git clone https://github.com/martijn-on-fhir/fhir-client-v3.git
cd fhir-client-v3

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run build:prod
```

## Getting Started

### Connecting to a FHIR Server

1. Open the application
2. Click the **Settings** icon (gear) in the header
3. Go to the **Servers** tab
4. Click **Add** to create a new server profile
5. Enter the server URL and configure authentication
6. Save and select the profile to connect

### Supported Authentication Methods

- **None** - For open/public FHIR servers
- **Basic Auth** - Username and password
- **Bearer Token** - Static access token
- **OAuth2/SMART on FHIR** - Full OAuth2 flow with token refresh
- **mTLS** - Mutual TLS with client certificates

### Running Your First Query

1. Select a server profile from the dropdown in the header
2. Go to the **Query** tab
3. Select a resource type (e.g., `Patient`)
4. Add search parameters using the visual builder or switch to text mode
5. Click **Execute** to run the query
6. View results in the JSON viewer with syntax highlighting

## Settings

Access settings via the gear icon in the header.

### Server Profiles

Manage your FHIR server connections. Each profile stores:
- Server URL
- Authentication configuration
- Custom headers
- Color coding for easy identification

### Two-Factor Authentication

Add an extra layer of security with TOTP-based 2FA.

### Display Preferences

- Toggle between light and dark themes
- Show/hide tabs based on your workflow
- Reset to default settings

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Execute query |
| `Ctrl+/` | Toggle comment in editors |
| `Ctrl+F` | Find in editor |
| `Ctrl+Click` | Navigate to URL (profiles, terminology, external links) |
| `Escape` | Close dialogs |

## Technology

Built with modern web technologies:

- **Angular 18** - Frontend framework with signals and standalone components
- **Electron 39** - Cross-platform desktop application
- **Monaco Editor** - VS Code's editor for syntax highlighting
- **Bootstrap 5** - Responsive UI components
- **FHIRPath.js** - FHIRPath expression evaluation
- **Handlebars** - Template engine for narrative generation

## Support

- **Issues**: [GitHub Issues](https://github.com/martijn-on-fhir/fhir-client-v3/issues)
- **Documentation**: [Wiki](https://github.com/martijn-on-fhir/fhir-client-v3/wiki)

## License

This software is proprietary and not licensed for redistribution.

---

**FHIR Client** - Making FHIR development easier.
