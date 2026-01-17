# [1.26.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.25.0...v1.26.0) (2026-01-17)


### Features

* auto-execute query when navigating through history ([a489c49](https://github.com/martijn-on-fhir/fhir-client-v3/commit/a489c4965fe837b92a6881c6025098dc8d59e2ca))

# [1.25.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.24.0...v1.25.0) (2026-01-17)


### Features

* add Ctrl+click on code system URLs to perform terminology lookup ([bb3bdf1](https://github.com/martijn-on-fhir/fhir-client-v3/commit/bb3bdf18c3731fe1750e88f5ba7395b7a1681329))
* persist query/predefined/terminology results across tab navigation ([b79e14e](https://github.com/martijn-on-fhir/fhir-client-v3/commit/b79e14ee496dc6646f50903d1d9206686e76bcd3))

# [1.24.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.23.0...v1.24.0) (2026-01-17)


### Features

* open zibs.nl/wiki URLs in external browser on Ctrl+click ([ad16ef7](https://github.com/martijn-on-fhir/fhir-client-v3/commit/ad16ef766b7d6f5a0dd7d41a5188488f2d1f6cd2))

# [1.23.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.22.0...v1.23.0) (2026-01-17)


### Features

* add StructureDefinition lookup for Ctrl+click on canonical URLs ([88c78f5](https://github.com/martijn-on-fhir/fhir-client-v3/commit/88c78f50e51f08388f37f2a646ab3dcddf3e1934))

# [1.22.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.21.0...v1.22.0) (2026-01-17)


### Bug Fixes

* move security inside meta in resource blueprint ([070fd6c](https://github.com/martijn-on-fhir/fhir-client-v3/commit/070fd6c12930c98f3bebbff912f619acd9233c22))


### Features

* add CodeSystem lookup for HL7 FHIR URLs on Ctrl+click ([0d60e3f](https://github.com/martijn-on-fhir/fhir-client-v3/commit/0d60e3f0d2c754b137fa10b8c52d0b789d4d563c))

# [1.21.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.20.0...v1.21.0) (2026-01-16)


### Features

* add Ctrl+click link handling in Monaco editor ([86d44b8](https://github.com/martijn-on-fhir/fhir-client-v3/commit/86d44b8798af9ee33c669ec8b2af401b707df6e7))
* add edit button for single resources in query results ([1c88040](https://github.com/martijn-on-fhir/fhir-client-v3/commit/1c8804016d49ba58fe56a6b4ef7b38c591dea218))

# [1.20.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.19.0...v1.20.0) (2026-01-16)


### Bug Fixes

* use app.getVersion() for dynamic splash screen version ([a7f1b33](https://github.com/martijn-on-fhir/fhir-client-v3/commit/a7f1b33b48c8e08e4c99443615ff38874754b4c6))


### Features

* add pagination controls to predefined tab ([6709c2c](https://github.com/martijn-on-fhir/fhir-client-v3/commit/6709c2c2fe2cba781e9880d2726c83a1337a681f))

# [1.19.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.18.1...v1.19.0) (2026-01-16)


### Bug Fixes

* enable file open in FHIRPath tab via Electron menu ([2898d68](https://github.com/martijn-on-fhir/fhir-client-v3/commit/2898d68dd4aecbe37131a3764da25d8a6dc22bf5))
* use visualModeEditor signal to avoid ExpressionChangedAfterItHasBeenCheckedError ([a86d91f](https://github.com/martijn-on-fhir/fhir-client-v3/commit/a86d91f392aa9ffa06466425cca4bb64e1443d3c))


### Features

* add chained search autocomplete for reference parameters ([b66d728](https://github.com/martijn-on-fhir/fhir-client-v3/commit/b66d728b96746140dee165060bcf1f077c661297))
* add pagination controls to query result header ([9d160cc](https://github.com/martijn-on-fhir/fhir-client-v3/commit/9d160cc3d19fc721e58ad5ab55688896ee89f346))

## [1.18.1](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.18.0...v1.18.1) (2026-01-15)


### Bug Fixes

* generated query box now respects dark mode ([94cbc7a](https://github.com/martijn-on-fhir/fhir-client-v3/commit/94cbc7a5193c66c2379cb3bb0dca6e55c26641d7))

# [1.18.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.17.0...v1.18.0) (2026-01-15)


### Bug Fixes

* logout now clears session and redirects to login ([f8ac3e0](https://github.com/martijn-on-fhir/fhir-client-v3/commit/f8ac3e00080ffc20a219384321e32961274363d6))
* resolve ExpressionChangedAfterItHasBeenCheckedError in QueryComponent ([164d82a](https://github.com/martijn-on-fhir/fhir-client-v3/commit/164d82ac484acea8dc78fa6869a39c333d52e067))
* resource editor dialog now respects dark mode ([f4d9a79](https://github.com/martijn-on-fhir/fhir-client-v3/commit/f4d9a797c4eb656cc67b827dcae06c904ee0e235)), closes [#f8f9fa](https://github.com/martijn-on-fhir/fhir-client-v3/issues/f8f9fa)
* server selector dropdown now respects dark mode ([6ddfdf0](https://github.com/martijn-on-fhir/fhir-client-v3/commit/6ddfdf0474a1db644842b7b2c7776f55423b49b7))


### Features

* add custom headers per server profile ([a4f6a9d](https://github.com/martijn-on-fhir/fhir-client-v3/commit/a4f6a9d8f159f0c1cccf75bf3814a3591d7bea3e))
* add portable Windows build configuration ([7f843cb](https://github.com/martijn-on-fhir/fhir-client-v3/commit/7f843cb7ace1051abff5f6dc8359937ff0ed1df3))
* add profile editing, menu access, and OAuth2 scope support ([346eb8a](https://github.com/martijn-on-fhir/fhir-client-v3/commit/346eb8a3075c1a0e5af0c0f672d6ddc45004f059))
* complete multi-server profile feature ([20e6587](https://github.com/martijn-on-fhir/fhir-client-v3/commit/20e658730269e03f1b61b96d046d71ccb137fcfe))
* **wip:** multi-server profile infrastructure ([d621d9b](https://github.com/martijn-on-fhir/fhir-client-v3/commit/d621d9bf130898ed93085891a8d5294e856390e8))
* rewrite login and settings to use ServerProfiles ([f1bf8d8](https://github.com/martijn-on-fhir/fhir-client-v3/commit/f1bf8d852b89e200b11420a8c031267c27f29cc6))

# [1.17.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.16.1...v1.17.0) (2026-01-14)


### Features

* add autocomplete for _include and _revinclude parameters ([3bb7f57](https://github.com/martijn-on-fhir/fhir-client-v3/commit/3bb7f5703fcda38cecd3213ba3438580bf8dd79e))

## [1.16.1](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.16.0...v1.16.1) (2026-01-14)


### Bug Fixes

* remove duplicate _summary values in autocomplete dropdown ([3e497ad](https://github.com/martijn-on-fhir/fhir-client-v3/commit/3e497adaaa71020f65e7443c05392e904f18002b))

# [1.16.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.15.0...v1.16.0) (2026-01-14)


### Features

* add /review custom command for code reviews ([495b381](https://github.com/martijn-on-fhir/fhir-client-v3/commit/495b3815a6863f48739b01c4b625e939ef8125e5))

# [1.15.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.14.0...v1.15.0) (2026-01-14)


### Features

* add Claude hook to run lint before git push ([8f2de5f](https://github.com/martijn-on-fhir/fhir-client-v3/commit/8f2de5f03cba5995bd1cbf39b0ace1814e3c811c))

# [1.14.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.13.0...v1.14.0) (2026-01-14)


### Bug Fixes

* Enter key executes query in FHIR Query text mode ([cccb2e4](https://github.com/martijn-on-fhir/fhir-client-v3/commit/cccb2e4954d3ddd6e3d490ea30ac4267d20d1ba8))


### Features

* add FHIR query autocomplete POC in Features tab ([f31b728](https://github.com/martijn-on-fhir/fhir-client-v3/commit/f31b7289211d3e2b06fd8a19ff76c433a208649b))
* integrate autocomplete into FHIR Query text mode ([b9dccc9](https://github.com/martijn-on-fhir/fhir-client-v3/commit/b9dccc9187504b0125428d9391860b4a1289a4b8))
* show query errors as toast notifications ([3d23b34](https://github.com/martijn-on-fhir/fhir-client-v3/commit/3d23b34094ca68af44896ab9273d6332ad8056a8))

# [1.13.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.12.1...v1.13.0) (2026-01-13)


### Bug Fixes

* auto-select first subscription and dark/light mode styling ([2811390](https://github.com/martijn-on-fhir/fhir-client-v3/commit/2811390791983b1e5d8c4c8d37fb0b590cb601fd))


### Features

* add FHIR STU3 subscription management feature ([c3686a5](https://github.com/martijn-on-fhir/fhir-client-v3/commit/c3686a509f1a52afd3a491904a842a9166359f00))

## [1.12.1](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.12.0...v1.12.1) (2026-01-13)


### Bug Fixes

* move execute and copy buttons inline with query preview ([3707b88](https://github.com/martijn-on-fhir/fhir-client-v3/commit/3707b88029ab5c0bf9015479851534f27dd1fff2))

# [1.12.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.11.0...v1.12.0) (2026-01-13)


### Features

* add toast notifications and enhance certificate manager UX ([b159bec](https://github.com/martijn-on-fhir/fhir-client-v3/commit/b159bec5aca27e4297701081dd67acbbe55810d3))
* externalize environment config and add FHIR URL to accounts ([bfdb187](https://github.com/martijn-on-fhir/fhir-client-v3/commit/bfdb187ffbe14191811b57e95da895ec3773c1ff))

# [1.11.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.10.0...v1.11.0) (2026-01-13)


### Features

* add global toast notification service ([dcbf289](https://github.com/martijn-on-fhir/fhir-client-v3/commit/dcbf2895c7037af5c4473c5a4d4221a054683c1d))

# [1.10.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.9.0...v1.10.0) (2026-01-13)


### Features

* change default import method to separate files ([107547d](https://github.com/martijn-on-fhir/fhir-client-v3/commit/107547d5d2e8c1e0059a72afe7ef026fc5ab86b6))

# [1.9.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.8.0...v1.9.0) (2026-01-12)


### Features

* add Certificate Manager with mTLS support ([cd67237](https://github.com/martijn-on-fhir/fhir-client-v3/commit/cd67237b6d05c6a54b8b5e11cdc561a53e35c34c))

# [1.8.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.7.0...v1.8.0) (2026-01-11)


### Features

* rebrand to FHIR Client MX and improve file handling ([8c9188e](https://github.com/martijn-on-fhir/fhir-client-v3/commit/8c9188eb886ec6af1d196f3b3a0c49cc86341f8a))

# [1.7.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.6.0...v1.7.0) (2026-01-11)


### Features

* add splash screen with branding and version display ([c99544a](https://github.com/martijn-on-fhir/fhir-client-v3/commit/c99544aaf4a5340b760980781da1524ffe9dbc30))

# [1.6.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.5.5...v1.6.0) (2026-01-11)


### Features

* add Settings and Certificate Manager menu items to File menu ([bd8e393](https://github.com/martijn-on-fhir/fhir-client-v3/commit/bd8e39319259e20d64d5e0c4762bb45cbad30040))

## [1.5.5](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.5.4...v1.5.5) (2026-01-11)


### Bug Fixes

* improve security and resolve visual builder layout issues ([4f1005b](https://github.com/martijn-on-fhir/fhir-client-v3/commit/4f1005b801979c9e41a335b8b1633ddc4293dc3c))

## [1.5.4](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.5.3...v1.5.4) (2026-01-11)


### Bug Fixes

* resolve visual builder layout and change detection issues ([61cdb68](https://github.com/martijn-on-fhir/fhir-client-v3/commit/61cdb687ac707fd90b87fcec2b368332240edb2b))

## [1.5.3](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.5.2...v1.5.3) (2026-01-11)


### Bug Fixes

* always show result headers, only toggle body content ([716a536](https://github.com/martijn-on-fhir/fhir-client-v3/commit/716a536a14239f92fc8911217d9a87c39bcff965))
* always show toolbar regardless of editor availability ([5365051](https://github.com/martijn-on-fhir/fhir-client-v3/commit/536505143ec8be29f086d56d993b73c778fa042d))

## [1.5.2](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.5.1...v1.5.2) (2026-01-11)

## [1.5.1](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.5.0...v1.5.1) (2026-01-11)


### Bug Fixes

* add XML support and retry mechanism to toolbar load/save ([c13f35b](https://github.com/martijn-on-fhir/fhir-client-v3/commit/c13f35b31699072c04fd80eb476068b0403d27ab))

# [1.5.0](https://github.com/martijn-on-fhir/fhir-client-v3/compare/v1.4.1...v1.5.0) (2026-01-11)


### Features

* implement file open/save functionality with local Monaco loading ([679c84f](https://github.com/martijn-on-fhir/fhir-client-v3/commit/679c84fa948a6c5fe03c2786308de6c27b7d0dc8))

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
