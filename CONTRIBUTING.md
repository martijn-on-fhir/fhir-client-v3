# Contributing to FHIR Client v3

Thank you for your interest in contributing to FHIR Client v3!

## Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and [semantic-release](https://semantic-release.gitbook.io/) to automatically generate releases and changelogs.

### Commit Message Structure

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)
- **perf**: Performance improvements (triggers patch version bump)
- **refactor**: Code refactoring (triggers patch version bump)
- **docs**: Documentation changes (no release)
- **style**: Code style changes (no release)
- **test**: Adding or updating tests (no release)
- **chore**: Maintenance tasks (no release)

### Breaking Changes

Add `BREAKING CHANGE:` in the commit footer or add `!` after the type to trigger a major version bump:

```
feat!: redesign authentication flow

BREAKING CHANGE: The authentication API has been completely redesigned.
Users will need to re-authenticate after this update.
```

### Examples

```bash
# Feature (triggers v3.1.0)
feat(templates): add export to CSV functionality

# Bug fix (triggers v3.0.1)
fix(auth): resolve token refresh issue

# Performance improvement (triggers v3.0.1)
perf(query): optimize FHIR query execution

# Breaking change (triggers v4.0.0)
feat(api)!: restructure FHIR service interface

BREAKING CHANGE: FhirService methods now return Observables instead of Promises
```

### Scopes

Common scopes in this project:
- `templates`: Smart query templates
- `auth`: Authentication
- `query`: FHIR queries
- `ui`: User interface
- `editor`: Template/resource editors
- `validation`: Validation logic
- `profiles`: Profile management
- `logs`: Logging system

## Development Workflow

1. Create a feature branch from `master`
2. Make your changes
3. Write tests if applicable
4. Commit using conventional commit format
5. Push and create a pull request
6. Once merged to `master`, semantic-release will automatically:
   - Analyze commits
   - Determine version bump
   - Generate changelog
   - Create GitHub release
   - Update package.json version

## Running Tests

```bash
npm test
```

## Linting

```bash
npm run lint
npm run lint:fix
```

## Building

```bash
# Development build
npm run build

# Production build with Electron packaging
npm run build:prod
```

## Questions?

Feel free to open an issue for any questions or discussions!
