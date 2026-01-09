# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2024-01-09

### Added
- Initial release of FHIR Client v3 with Angular 18 and Electron
- Smart query templates with parameter support
- Template browser with category organization
- Template editor with validation
- Template config dialog for parameter input
- Predefined queries for common FHIR operations
- Monaco editor integration for JSON viewing
- FHIR resource validation
- FHIRPath query support
- Terminology browser
- Profile management
- Authentication with SMART on FHIR
- Two-factor authentication support
- Logging system with electron-log
- Nictiz integration

### Changed
- Migrated from React (v2) to Angular 18 (v3)
- Switched from Material-UI to Bootstrap 5
- Updated to Electron 39

### Migration from v2
This is a complete rewrite of the FHIR Client application using Angular 18 instead of React. For users upgrading from v2, please note:
- Configuration and settings are stored in a new format
- Templates need to be re-created or imported
- Authentication sessions need to be re-established
