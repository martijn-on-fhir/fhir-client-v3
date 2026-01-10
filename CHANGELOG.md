## [1.4.1](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.4.0...v1.4.1) (2026-01-10)

# [1.4.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.3.1...v1.4.0) (2026-01-10)


### Bug Fixes

*  eslint issues ([7e1f3a5](https://github.com/martijn-on-fhir/fhir-client-v3/commit/7e1f3a5b1b4709c3d82dd27f66feed78f38b54c4))


### Features

* enhance log viewer with table layout, performance improvements, and robust parsing ([9fb7309](https://github.com/martijn-on-fhir/fhir-client-v3/commit/9fb73094583137c2566a8ce6a89e9d6ecb45c07b))

## [1.3.1](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.3.0...v1.3.1) (2026-01-10)


### Bug Fixes

* restore close button visibility in resource editor dialog ([1373fa3](https://github.com/martijn-on-fhir/fhir-client-v3/commit/1373fa304af4f85e45c1089a4cc703eaaa8e7d45))

# [1.3.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.2.1...v1.3.0) (2026-01-10)


### Features

* add Escape key support to server info dialog ([49a566e](https://github.com/martijn-on-fhir/fhir-client-v3/commit/49a566e64019db92c2bffc9cca3d8fe4baeb4c0b))
* add server info dialog and improve UI components ([60ed8e7](https://github.com/martijn-on-fhir/fhir-client-v3/commit/60ed8e76412e8e79cbcd50acb50ab881737683bd))

## [1.2.1](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.2.0...v1.2.1) (2026-01-10)

# [1.2.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.1.0...v1.2.0) (2026-01-09)


### Bug Fixes

* parameter editor not loading values on edit ([386871e](https://github.com/martijn-on-fhir/fhir-client-v3/commit/386871efd30ca9405513cd54dea81a7f8f4dc42c))
* template editor dialog not loading values on edit ([63679ab](https://github.com/martijn-on-fhir/fhir-client-v3/commit/63679ab335f33277afe7c0b81be789f6803eaa11))


### Features

* integrate monaco editor with json viewer toolbar ([5a69223](https://github.com/martijn-on-fhir/fhir-client-v3/commit/5a69223f9c9706bb39ee8e6df121f71953f557bb))
* pass monaco editor reference to json viewer toolbar ([6ba091d](https://github.com/martijn-on-fhir/fhir-client-v3/commit/6ba091d5c8b0e0b3f5b96f8e03512e53e734a4a8))

# [1.1.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.0.0...v1.1.0) (2026-01-09)


### Bug Fixes

* ensure mode toggle buttons are always visible ([00b3904](https://github.com/martijn-on-fhir/fhir-client-v3/commit/00b39045fd00f7f2ac1b98d3dff69a1f71e7252c))
* move history buttons to text mode only and align heights ([f1b1b12](https://github.com/martijn-on-fhir/fhir-client-v3/commit/f1b1b1261207e7953cbee5f4b99fd8714b065cd8))


### Features

* **query:** implement query history navigation matching v2 ([3304814](https://github.com/martijn-on-fhir/fhir-client-v3/commit/3304814a490228d9c6a38980f41b31e5a6f6bbd5))

# 1.0.0 (2026-01-09)


### Features

* **ui:** implement custom primary color and dark mode support ([1c0885a](https://github.com/martijn-on-fhir/fhir-client-v3/commit/1c0885a7dccc815155b472cdeefb552e53d4f85b))
* **resource-info:** implement Resource Info tab from v2 ([1037c5f](https://github.com/martijn-on-fhir/fhir-client-v3/commit/1037c5f9c5653a07a28880332a6e498dd5932f2d))

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
