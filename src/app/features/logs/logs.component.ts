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

  private get logger() {
    return this.loggerService.component('LogsComponent');
  }

  // State signals
  logs = signal<LogEntry[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  watching = signal(false);
  searchText = signal('');
  selectedLevel = signal<'all' | 'debug' | 'info' | 'warn' | 'error'>('all');
  autoScroll = signal(true);
  logPaths = signal<{ mainLog: string; rendererLog: string } | null>(null);
  selectedComponent = signal<string>('all');

  filteredLogs = computed(() => {

    const allLogs = this.logs();
    const search = this.searchText().toLowerCase();
    const level = this.selectedLevel();
    const component = this.selectedComponent();

    return allLogs.filter(log => {

      // Level filter
      if (level !== 'all' && log.level !== level) {
        return false;
      }

      // Component filter
      if (component !== 'all' && log.component !== component) {
        return false;
      }

      // Search filter (includes component and process in search)
      if (search) {
        const searchableText = `${log.message} ${log.raw} ${log.component || ''} ${log.process || ''}`;
        if (!searchableText.toLowerCase().includes(search)) {
          return false;
        }
      }

      return true;

    });
  });

  // Stats
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

  // Get unique components for filter dropdown
  uniqueComponents = computed(() => {
    const components = new Set<string>();

    this.logs().forEach(log => {
      if (log.component) {
        components.add(log.component);
      }
    });

    return Array.from(components).sort();
  });

  private unwatchCallback?: () => void;

  constructor(private loggerService: LoggerService) {}

  async ngOnInit() {

    // Load only last 500 lines by default for better performance
    await this.loadLogs(500);
    await this.loadLogPaths();

    // Set up listener for log updates
    if (window.electronAPI?.onLogsUpdated) {

      this.unwatchCallback = window.electronAPI.onLogsUpdated(() => {
        this.logger.debug('Logs updated, reloading...');
        // Reload with same tail limit for performance
        this.loadLogs(500);
      });
    }
  }

  ngOnDestroy() {

    this.stopWatching();

    if (this.unwatchCallback) {
      this.unwatchCallback();
    }
  }

  /**
   * Load log paths from electron
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
   * Load logs from disk
   */
  async loadLogs(tail?: number) {

    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await window.electronAPI?.logs?.read({ tail });

      if (result && 'logs' in result) {

        this.logs.set(result.logs);

        // Auto-scroll to bottom if enabled
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
   * Start watching for log updates
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
   * Stop watching for log updates
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
   * Toggle watch mode
   */
  async toggleWatch() {
    if (this.watching()) {
      await this.stopWatching();
    } else {
      await this.startWatching();
    }
  }

  /**
   * Export logs to file
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
   * Refresh logs
   */
  async refresh() {
    // Refresh with last 500 lines for performance
    await this.loadLogs(500);
  }

  /**
   * Clear displayed logs (doesn't delete files)
   */
  clear() {
    this.logs.set([]);
    this.logger.info('Cleared displayed logs');
  }

  /**
   * Load last N lines
   */
  async loadTail(lines: number) {
    await this.loadLogs(lines);
  }

  /**
   * Scroll to bottom of log container
   */
  private scrollToBottom() {
    const container = document.querySelector('.log-container');

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Get CSS class for log level
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
   * Get icon for log level
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
