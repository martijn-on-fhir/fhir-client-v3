const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const log = require('electron-log/main');

/**
 * Electron Log File Handler
 *
 * Provides IPC handlers for reading, watching, and exporting application logs
 */

let fileWatcher = null;

/**
 * Get log file paths
 */
function getLogPaths() {
  return {
    mainLog: log.transports.file.getFile().path,
    rendererLog: log.transports.file.getFile().path // Same file for both
  };
}

/**
 * Parse multiple log lines with multi-line support
 * Groups continuation lines with their parent entry
 * @param {string[]} lines - Array of log lines
 * @param {string} source - Source identifier (main/renderer)
 * @returns {Object[]} - Parsed log entries
 */
function parseLogLines(lines, source = 'main') {
  const TIMESTAMP_PATTERN = /^\s*\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\]/;
  const entries = [];
  let currentEntry = null;

  for (const line of lines) {
    const startsWithTimestamp = TIMESTAMP_PATTERN.test(line);

    if (startsWithTimestamp) {
      // Save previous entry
      if (currentEntry) {
        entries.push(currentEntry);
      }

      // Start new entry
      currentEntry = parseLogLine(line, source);
      currentEntry.lineCount = 1;
    } else if (currentEntry) {
      // Safety cap: prevent runaway multi-line entries
      if (currentEntry.lineCount > 500) {
        entries.push(currentEntry);
        currentEntry = null;
      } else {
        // Continuation line
        currentEntry.message += '\n' + line;
        currentEntry.raw += '\n' + line;
        currentEntry.lineCount++;
      }
    } else {
      // Orphan line without parent
      entries.push({
        source,
        raw: line,
        timestamp: null,
        level: null,
        process: null,
        component: null,
        message: line,
        lineCount: 1
      });
    }
  }

  // Don't forget last entry
  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

/**
 * Parse a log line into structured format
 * Format: [YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [Process?] [Component?] message
 */
function parseLogLine(line, source = 'main') {
  // Trim leading/trailing whitespace
  const trimmedLine = line.trim();

  // Try to extract bracketed sections step by step
  let remaining = trimmedLine;
  const brackets = [];

  // Extract all [bracketed] sections from the start
  while (remaining.startsWith('[')) {
    const endIndex = remaining.indexOf(']');
    if (endIndex === -1) break;

    const content = remaining.substring(1, endIndex);
    brackets.push(content);

    // Move past this bracket and any whitespace
    remaining = remaining.substring(endIndex + 1).trimStart();
  }

  // Now we have all brackets and the remaining message
  if (brackets.length >= 2) {
    const timestamp = brackets[0].replace(/\.\d{3}$/, '').trim(); // Remove milliseconds
    const level = brackets[1].toLowerCase().trim();

    let processInfo = null;
    let componentInfo = null;
    let message = remaining;

    // Check if we have process (3rd bracket)
    if (brackets.length >= 3) {
      processInfo = brackets[2].trim();

      // Check if we have component (4th bracket)
      if (brackets.length >= 4) {
        componentInfo = brackets[3].trim();
      }
    }

    return {
      source,
      raw: line,
      timestamp,
      level,
      process: processInfo || null,
      component: componentInfo || null,
      message: message.trim()
    };
  }

  // Fallback for unparseable lines
  return {
    source,
    raw: line,
    timestamp: null,
    level: null,
    process: null,
    component: null,
    message: line
  };
}

/**
 * Read log file and return parsed entries
 */
function readLogFile(options = {}) {
  const { tail } = options;
  const logPath = log.transports.file.getFile().path;

  try {
    if (!fs.existsSync(logPath)) {
      return {
        logs: [],
        message: 'Log file does not exist yet'
      };
    }

    const content = fs.readFileSync(logPath, 'utf8');
    let lines = content.split('\n').filter(line => line.trim());

    // Apply tail if specified
    if (tail && tail > 0) {
      lines = lines.slice(-tail);
    }

    // Parse all lines with multi-line support
    const logs = parseLogLines(lines, 'main');

    return { logs };
  } catch (error) {
    log.error('Error reading log file:', error);
    return {
      error: `Failed to read log file: ${error.message}`
    };
  }
}

/**
 * Start watching log file for changes
 */
function startWatching(mainWindow) {
  if (fileWatcher) {
    return { success: false, error: 'Already watching' };
  }

  const logPath = log.transports.file.getFile().path;

  try {
    fileWatcher = fs.watch(logPath, { persistent: false }, (eventType) => {
      if (eventType === 'change') {
        // Notify renderer process
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('logs-updated');
        }
      }
    });

    log.info('Started watching log file');
    return { success: true };
  } catch (error) {
    log.error('Error starting file watch:', error);
    return {
      error: `Failed to watch log file: ${error.message}`
    };
  }
}

/**
 * Stop watching log file
 */
function stopWatching() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
    log.info('Stopped watching log file');
    return { success: true };
  }

  return { success: true };
}

/**
 * Export logs to user-selected file
 */
async function exportLogs(mainWindow) {
  const logPath = log.transports.file.getFile().path;

  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Logs',
      defaultPath: path.join(require('os').homedir(), 'fhir-client-logs.txt'),
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Log Files', extensions: ['log'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // Copy log file to selected location
    const content = fs.readFileSync(logPath, 'utf8');
    fs.writeFileSync(filePath, content, 'utf8');

    log.info('Exported logs to:', filePath);
    return { success: true, path: filePath };
  } catch (error) {
    log.error('Error exporting logs:', error);
    return {
      error: `Failed to export logs: ${error.message}`
    };
  }
}

/**
 * Register all log-related IPC handlers
 */
function registerLogHandlers(mainWindow) {
  // Get log file paths
  ipcMain.handle('logs:getPaths', () => {
    try {
      return getLogPaths();
    } catch (error) {
      log.error('Error getting log paths:', error);
      return { error: error.message };
    }
  });

  // Read log file
  ipcMain.handle('logs:read', (event, options) => {
    try {
      return readLogFile(options);
    } catch (error) {
      log.error('Error reading logs:', error);
      return { error: error.message };
    }
  });

  // Start watching
  ipcMain.handle('logs:watch', () => {
    try {
      return startWatching(mainWindow);
    } catch (error) {
      log.error('Error starting watch:', error);
      return { error: error.message };
    }
  });

  // Stop watching
  ipcMain.handle('logs:unwatch', () => {
    try {
      return stopWatching();
    } catch (error) {
      log.error('Error stopping watch:', error);
      return { error: error.message };
    }
  });

  // Export logs
  ipcMain.handle('logs:export', () => {
    try {
      return exportLogs(mainWindow);
    } catch (error) {
      log.error('Error exporting logs:', error);
      return { error: error.message };
    }
  });

  log.info('Log IPC handlers registered');
}

module.exports = {
  registerLogHandlers
};
