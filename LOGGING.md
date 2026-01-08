# Logging

This application uses `electron-log` for centralized logging with file persistence and automatic log rotation.

## Overview

All logging is done through the `LoggerService` which:
- Automatically redacts sensitive data (tokens, passwords, secrets)
- Writes to both console and log files
- Provides component-scoped logging
- Supports multiple log levels

## Log Levels

- `debug` - Detailed debugging information (development only)
- `info` - General informational messages
- `warn` - Warning messages
- `error` - Error messages

## Usage

### In Angular Components/Services

```typescript
import { LoggerService } from '@core/services/logger.service';

export class MyComponent {
  private logger = this.loggerService.component('MyComponent');

  constructor(private loggerService: LoggerService) {}

  someMethod() {
    this.logger.info('Processing data');
    this.logger.warn('Deprecated feature used');
    this.logger.error('Operation failed', error);
    this.logger.debug('Variable state', { count: 10 });
  }
}
```

### Direct Logging

```typescript
this.loggerService.info('Application started');
this.loggerService.error('Fatal error occurred', error);
```

## Log File Locations

### Windows
```
%USERPROFILE%\AppData\Roaming\fhir-client\logs\main.log
```

### macOS
```
~/Library/Logs/fhir-client/main.log
```

### Linux
```
~/.config/fhir-client/logs/main.log
```

## Log File Configuration

- **Max file size**: 5 MB
- **Auto rotation**: Yes
- **Format**: `[YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] message`

## Sensitive Data Protection

The logger automatically redacts:
- `access_token`
- `refresh_token`
- `client_secret`
- `password`
- `authorization` headers
- Any field named `secret`

Example:
```typescript
// Input
logger.info('Login successful', { access_token: 'abc123', username: 'john' });

// Output
logger.info('Login successful', { access_token: '[REDACTED]', username: 'john' });
```

## Development vs Production

- **Development**: All log levels are written to console and file
- **Production**: Only `warn` and `error` levels are written to console; all levels go to file

## Best Practices

1. **Use component-scoped loggers**: Makes it easier to trace issues
   ```typescript
   private logger = this.loggerService.component('MyComponent');
   ```

2. **Log errors with context**: Include relevant data
   ```typescript
   this.logger.error('Failed to save user', { userId, error });
   ```

3. **Use appropriate levels**:
   - `debug` - Temporary debugging info
   - `info` - Important application flow
   - `warn` - Recoverable issues
   - `error` - Failures that need attention

4. **Don't log in tight loops**: Can impact performance

5. **Avoid console.log**: Always use LoggerService instead

## ESLint Configuration

The project is configured to warn on direct `console.log` usage:

```javascript
'no-console': ['warn', { allow: ['warn', 'error'] }]
```

This encourages using the LoggerService for all logging.

## Viewing Logs

### During Development
Logs appear in both:
- Browser DevTools console
- Log file (auto-updates)

### In Production
- Check the log file in the locations mentioned above
- Use `tail -f` on macOS/Linux or a log viewer on Windows

### Via Electron DevTools
```javascript
// Open DevTools
mainWindow.webContents.openDevTools();

// View logs in Console tab
```

## Troubleshooting

**Logs not appearing?**
- Check if LoggerService is injected correctly
- Verify `electronAPI.log` is exposed in preload.js
- Check log file permissions

**Sensitive data in logs?**
- Verify the data pattern matches `SENSITIVE_PATTERNS` in logger.service.ts
- Add new patterns if needed
- Report security issues immediately
