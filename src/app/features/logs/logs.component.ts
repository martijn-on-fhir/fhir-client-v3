import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoggerService } from '../../core/services/logger.service';

interface LogEntry {
  source: string;
  raw: string;
  timestamp: string | null;
  level: 'debug' | 'info' | 'warn' | 'error' | null;
  process: string | null;
  component: string | null;
  message: string;
}

/**
 * Logs Component - View application logs
 *
 * Features:
 * - Real-time log viewing from disk
 * - Live updates (watch mode)
 * - Filter by level and search text
 * - Export logs to file
 * - Color-coded log levels
 */
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss'
})
export class LogsComponent implements OnInit, OnDestroy {

  /**
   * Logger instance for this component
   */
  private get logger() {
    return this.loggerService.component('LogsComponent');
  }

  /**
   * Array of log entries loaded from the log file
   */
  logs = signal<LogEntry[]>([]);

  /**
   * Loading state indicator
   */
  loading = signal(false);

  /**
   * Error message if log loading fails
   */
  error = signal<string | null>(null);

  /**
   * Whether file watching is active for live updates
   */
  watching = signal(false);

  /**
   * Search text filter
   */
  searchText = signal('');

  /**
   * Selected log level filter
   */
  selectedLevel = signal<'all' | 'debug' | 'info' | 'warn' | 'error'>('all');

  /**
   * Whether to auto-scroll to bottom when new logs are loaded
   */
  autoScroll = signal(true);

  /**
   * Paths to the log files (main and renderer)
   */
  logPaths = signal<{ mainLog: string; rendererLog: string } | null>(null);

  /**
   * Selected component filter
   */
  selectedComponent = signal<string>('all');

  /**
   * Filtered logs based on search text, level, and component filters
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
   * Statistics about log entries (total, counts per level, filtered count)
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
   * Unique component names extracted from all logs for the filter dropdown
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

  /**
   * Callback to unregister the file watcher listener
   */
  private unwatchCallback?: () => void;

  /**
   * Creates an instance of LogsComponent
   * @param loggerService Service for logging operations
   */
  constructor(private loggerService: LoggerService) {}

  /**
   * Component initialization lifecycle hook
   * Loads the last 500 log entries and sets up file watcher for live updates
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
   * Component cleanup lifecycle hook
   * Stops file watching and cleans up listeners
   */
  ngOnDestroy() {
    this.stopWatching();

    if (this.unwatchCallback) {
      this.unwatchCallback();
    }
  }

  /**
   * Loads the file system paths to the log files from Electron
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
   * Loads log entries from disk
   * @param tail Optional number of lines to load from the end of the file. If not specified, loads all entries.
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
   * @returns Promise that resolves when logs are refreshed
   */
  async refresh() {
    await this.loadLogs(500);
  }

  /**
   * Clears the displayed log entries without deleting the log files
   */
  clear() {
    this.logs.set([]);
    this.logger.info('Cleared displayed logs');
  }

  /**
   * Loads a specific number of log lines from the end of the file
   * @param lines Number of lines to load from the end
   * @returns Promise that resolves when logs are loaded
   */
  async loadTail(lines: number) {
    await this.loadLogs(lines);
  }

  /**
   * Scrolls the log container to the bottom to show the most recent entries
   */
  private scrollToBottom() {
    const container = document.querySelector('.log-container');

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Returns the Bootstrap CSS class for styling based on log level
   * @param level The log level (error, warn, info, debug, or null)
   * @returns Bootstrap text color class
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
   * @param level The log level (error, warn, info, debug, or null)
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
