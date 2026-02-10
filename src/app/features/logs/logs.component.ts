import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../core/services/logger.service';
import { ResultHeaderComponent } from '../../shared/components/result-header/result-header.component';

/**
 * Represents a single log entry from the application log file
 */
interface LogEntry {
  /** Source of the log entry (main or renderer process) */
  source: string;

  /** Raw unparsed log line from the file */
  raw: string;

  /** ISO timestamp of the log entry */
  timestamp: string | null;

  /** Log level severity (debug, info, warn, error) */
  level: 'debug' | 'info' | 'warn' | 'error' | null;

  /** Process that generated the log (main or renderer) */
  process: string | null;

  /** Component name that generated the log */
  component: string | null;

  /** Log message content */
  message: string;
}

/**
 * Logs Component
 *
 * Provides comprehensive log viewing and management interface.
 *
 * Features:
 * - Real-time log viewing from disk with file system integration
 * - Live updates via file watcher (watch mode)
 * - Multi-criteria filtering (level, component, search text)
 * - Log statistics and component-based filtering
 * - Export logs to file via Electron file API
 * - Auto-scroll to latest entries
 * - Color-coded log levels with icons
 * - Tail functionality for loading recent entries
 */
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, ResultHeaderComponent],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss'
})
export class LogsComponent implements OnInit, OnDestroy {

  /** Component-specific logger instance */
  private get logger() {
    return this.loggerService.component('LogsComponent');
  }

  /** Array of log entries loaded from the log file */
  logs = signal<LogEntry[]>([]);

  /** Loading state while reading log file */
  loading = signal(false);

  /** Error message from log file operations */
  error = signal<string | null>(null);

  /** Whether file watching is active for live updates */
  watching = signal(false);

  /** Search text filter for log content */
  searchText = signal('');

  /** Selected log level filter (all, debug, info, warn, error) */
  selectedLevel = signal<'all' | 'debug' | 'info' | 'warn' | 'error'>('all');

  /** Whether to auto-scroll to bottom when new logs are loaded */
  autoScroll = signal(true);

  /** File system paths to main and renderer log files */
  logPaths = signal<{ mainLog: string; rendererLog: string } | null>(null);

  /** Selected component name filter for logs */
  selectedComponent = signal<string>('all');

  /**
   * Computed filtered logs based on current filters
   *
   * Applies three filters in sequence:
   * 1. Log level filter (if not 'all')
   * 2. Component filter (if not 'all')
   * 3. Text search across message, raw content, component, and process
   */
  filteredLogs = computed(() => {
    const allLogs = this.logs();
    const search = this.searchText().toLowerCase();
    const level = this.selectedLevel();
    const component = this.selectedComponent();

    return allLogs.filter(log => {
      if (level !== 'all' && log.level !== level) {
        return false;
      }

      if (component !== 'all' && log.component !== component) {
        return false;
      }

      if (search) {
        const searchableText = `${log.message} ${log.raw} ${log.component || ''} ${log.process || ''}`;

        if (!searchableText.toLowerCase().includes(search)) {
          return false;
        }
      }

      return true;
    });
  });

  /**
   * Computed statistics about log entries
   *
   * Provides counts for:
   * - Total number of loaded logs
   * - Count by each log level (debug, info, warn, error)
   * - Count of filtered logs after applying current filters
   */
  stats = computed(() => {
    const allLogs = this.logs();

    return {
      total: allLogs.length,
      debug: allLogs.filter(l => l.level === 'debug').length,
      info: allLogs.filter(l => l.level === 'info').length,
      warn: allLogs.filter(l => l.level === 'warn').length,
      error: allLogs.filter(l => l.level === 'error').length,
      filtered: this.filteredLogs().length,
    };
  });

  /**
   * Computed unique component names from all loaded logs
   *
   * Extracts all unique component names and sorts them alphabetically
   * for use in the component filter dropdown.
   */
  uniqueComponents = computed(() => {
    const components = new Set<string>();

    this.logs().forEach(log => {
      if (log.component) {
        components.add(log.component);
      }
    });

    return Array.from(components).sort();
  });

  /** Cleanup callback to unregister the file watcher listener from Electron */
  private unwatchCallback?: () => void;

  /**
   * Creates an instance of LogsComponent
   *
   * @param loggerService - Service for logging operations
   */
  constructor(private loggerService: LoggerService) {}

  /**
   * Angular lifecycle hook called on component initialization
   *
   * Workflow:
   * 1. Loads the last 500 log entries from disk
   * 2. Loads file system paths to log files
   * 3. Sets up Electron file watcher listener for automatic log updates
   */
  async ngOnInit() {
    await this.loadLogs(500);
    await this.loadLogPaths();

    if (window.electronAPI?.onLogsUpdated) {
      this.unwatchCallback = window.electronAPI.onLogsUpdated(() => {
        this.logger.debug('Logs updated, reloading...');
        this.loadLogs(500);
      });
    }
  }

  /**
   * Angular lifecycle hook called on component destruction
   *
   * Cleans up file watcher and unregisters Electron event listeners
   * to prevent memory leaks.
   */
  ngOnDestroy() {
    this.stopWatching();

    if (this.unwatchCallback) {
      this.unwatchCallback();
    }
  }

  /**
   * Loads the file system paths to the log files from Electron
   *
   * Retrieves the absolute file paths for both main and renderer process log files
   * from Electron API and updates the logPaths signal.
   *
   * @returns Promise that resolves when paths are loaded
   */
  async loadLogPaths() {
    try {
      const result = await window.electronAPI?.logs?.getPaths();

      if (result && 'mainLog' in result) {
        this.logPaths.set(result);
      }
    } catch (err) {
      this.logger.error('Failed to get log paths:', err);
    }
  }

  /**
   * Loads log entries from disk via Electron file API
   *
   * Reads log file from disk, parses entries, and updates the logs signal.
   * If autoScroll is enabled, scrolls to the bottom after loading.
   * Sets loading state during operation and error state on failure.
   *
   * @param tail - Optional number of lines to load from the end of the file. If not specified, loads all entries.
   * @returns Promise that resolves when logs are loaded
   */
  async loadLogs(tail?: number) {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await window.electronAPI?.logs?.read({ tail });

      if (result && 'logs' in result) {
        this.logs.set(result.logs);

        if (this.autoScroll()) {
          setTimeout(() => this.scrollToBottom(), 100);
        }
      } else if (result && 'error' in result) {
        this.error.set(result.error);
        this.logger.error('Failed to load logs:', result.error);
      }
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load logs');
      this.logger.error('Error loading logs:', err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Starts watching the log file for changes to enable live updates
   *
   * Activates file system watcher via Electron API. When the log file changes,
   * Electron triggers the onLogsUpdated event (registered in ngOnInit) which
   * automatically reloads the logs.
   *
   * @returns Promise that resolves when watching is started
   */
  async startWatching() {
    try {
      const result = await window.electronAPI?.logs?.watch();

      if (result && 'success' in result && result.success) {
        this.watching.set(true);
      } else if (result && 'error' in result) {
        this.error.set(result.error);
        this.logger.error('Failed to start watching:', result.error);
      }
    } catch (err: any) {
      this.error.set(err.message || 'Failed to start watching');
      this.logger.error('Error starting watch:', err);
    }
  }

  /**
   * Stops watching the log file for changes
   *
   * Deactivates the file system watcher via Electron API.
   * Logs will no longer automatically reload when the file changes.
   *
   * @returns Promise that resolves when watching is stopped
   */
  async stopWatching() {
    try {
      const result = await window.electronAPI?.logs?.unwatch();

      if (result && 'success' in result && result.success) {
        this.watching.set(false);
        this.logger.info('Stopped watching logs');
      }
    } catch (err: any) {
      this.logger.error('Error stopping watch:', err);
    }
  }

  /**
   * Toggles the watch mode on or off
   *
   * If currently watching, stops watching.
   * If not watching, starts watching.
   *
   * @returns Promise that resolves when watch mode is toggled
   */
  async toggleWatch() {
    if (this.watching()) {
      await this.stopWatching();
    } else {
      await this.startWatching();
    }
  }

  /**
   * Exports log entries to a user-selected file location
   *
   * Opens a save dialog via Electron file API and writes the current
   * log file contents to the selected location. Does not set error
   * if user cancels the dialog.
   *
   * @returns Promise that resolves when export is complete or cancelled
   */
  async exportLogs() {
    try {
      const result = await window.electronAPI?.logs?.export();

      if (result && 'success' in result && result.success) {
        this.logger.info('Logs exported successfully to:', result.path);
      } else if (result && 'error' in result) {
        if (!result.canceled) {
          this.error.set(result.error);
          this.logger.error('Failed to export logs:', result.error);
        }
      }
    } catch (err: any) {
      this.error.set(err.message || 'Failed to export logs');
      this.logger.error('Error exporting logs:', err);
    }
  }

  /**
   * Refreshes the log display by reloading the last 500 entries
   *
   * Clears current logs and reloads from disk.
   * Useful for manually updating logs when watch mode is disabled.
   *
   * @returns Promise that resolves when logs are refreshed
   */
  async refresh() {
    await this.loadLogs(500);
  }

  /**
   * Clears log files from disk and the UI display
   *
   * Truncates the log files via Electron API, then clears the displayed logs.
   */
  async clear() {
    try {
      const result = await window.electronAPI?.logs?.clear();

      if (result && 'error' in result) {
        this.error.set(result.error);
        this.logger.error('Failed to clear log files:', result.error);
        return;
      }

      this.logs.set([]);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to clear log files');
      this.logger.error('Error clearing log files:', err);
    }
  }

  /**
   * Loads a specific number of log lines from the end of the file
   *
   * Delegates to loadLogs with the tail parameter to load only
   * the most recent N lines from the log file.
   *
   * @param lines - Number of lines to load from the end
   * @returns Promise that resolves when logs are loaded
   */
  async loadTail(lines: number) {
    await this.loadLogs(lines);
  }

  /**
   * Scrolls the log container to the bottom to show the most recent entries
   *
   * Automatically triggered after loading logs when autoScroll is enabled.
   * Uses DOM manipulation to scroll the container to its maximum scroll height.
   *
   * @private
   */
  private scrollToBottom() {
    const container = document.querySelector('.log-container');

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Returns the Bootstrap CSS class for styling based on log level
   *
   * Maps log levels to Bootstrap text color classes:
   * - error: text-danger (red)
   * - warn: text-warning (yellow)
   * - info: text-primary (blue)
   * - debug: text-secondary (gray)
   * - null/unknown: text-muted (light gray)
   *
   * @param level - The log level (error, warn, info, debug, or null)
   * @returns Bootstrap text color class name
   */
  getLevelClass(level: string | null): string {
    switch (level) {
      case 'error':
        return 'text-danger';
      case 'warn':
        return 'text-warning';
      case 'info':
        return 'text-primary';
      case 'debug':
        return 'text-secondary';
      default:
        return 'text-muted';
    }
  }

  /**
   * Returns the Font Awesome icon class based on log level
   *
   * Maps log levels to appropriate Font Awesome icons:
   * - error: fa-times-circle (X in circle)
   * - warn: fa-exclamation-triangle (warning triangle)
   * - info: fa-info-circle (i in circle)
   * - debug: fa-bug (bug icon)
   * - null/unknown: fa-circle (simple circle)
   *
   * @param level - The log level (error, warn, info, debug, or null)
   * @returns Font Awesome icon class name
   */
  getLevelIcon(level: string | null): string {
    switch (level) {
      case 'error':
        return 'fa-times-circle';
      case 'warn':
        return 'fa-exclamation-triangle';
      case 'info':
        return 'fa-info-circle';
      case 'debug':
        return 'fa-bug';
      default:
        return 'fa-circle';
    }
  }
}
