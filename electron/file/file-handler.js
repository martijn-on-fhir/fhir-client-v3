const { ipcMain, dialog, app } = require('electron');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const log = require('electron-log/main');

/**
 * Register file operation IPC handlers
 */
function registerFileHandlers() {
  /**
   * Open file dialog and read file content
   */
  ipcMain.handle('file:open', async () => {

    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'Xml Files', extensions: ['xml'] },
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        path: filePath,
        content: content
      };

    } catch (error) {
      log.error('Error opening file:', error);
      return { error: error.message };
    }
  });

  /**
   * Save file dialog and write content
   */
  ipcMain.handle('file:save', async (event, content, defaultFileName = 'export.json') => {

    try {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultFileName,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      await fs.writeFile(result.filePath, content, 'utf-8');

      return {
        path: result.filePath,
        success: true
      };
    } catch (error) {
      log.error('Error saving file:', error);
      return { error: error.message };
    }
  });

  /**
   * Create a temporary file for streaming exports
   * Returns the temp file path
   */
  ipcMain.handle('file:createTempExport', async (event, prefix = 'export') => {
    try {
      const tempDir = app.getPath('temp');
      const tempFileName = `${prefix}-${Date.now()}.ndjson`;
      const tempFilePath = path.join(tempDir, tempFileName);

      // Create empty file
      await fs.writeFile(tempFilePath, '', 'utf-8');

      log.info(`Created temp export file: ${tempFilePath}`);
      return { path: tempFilePath, success: true };
    } catch (error) {
      log.error('Error creating temp file:', error);
      return { error: error.message };
    }
  });

  /**
   * Append a line to a file (for NDJSON streaming)
   */
  ipcMain.handle('file:appendLine', async (event, filePath, line) => {
    try {
      await fs.appendFile(filePath, line + '\n', 'utf-8');
      return { success: true };
    } catch (error) {
      log.error('Error appending to file:', error);
      return { error: error.message };
    }
  });

  /**
   * Append multiple lines to a file (batch for better performance)
   */
  ipcMain.handle('file:appendLines', async (event, filePath, lines) => {
    try {
      const content = lines.map(line =>
        typeof line === 'string' ? line : JSON.stringify(line)
      ).join('\n') + '\n';
      await fs.appendFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      log.error('Error appending lines to file:', error);
      return { error: error.message };
    }
  });

  /**
   * Convert temp NDJSON to JSON array and save via dialog
   */
  ipcMain.handle('file:saveTempExport', async (event, tempFilePath, defaultFileName = 'export.json') => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultFileName,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'NDJSON Files', extensions: ['ndjson'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      const destPath = result.filePath;
      const isNdjson = destPath.endsWith('.ndjson');

      if (isNdjson) {
        // Just copy the file as-is
        await fs.copyFile(tempFilePath, destPath);
      } else {
        // Convert NDJSON to JSON array
        const content = await fs.readFile(tempFilePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        const resources = lines.map(line => JSON.parse(line));
        await fs.writeFile(destPath, JSON.stringify(resources, null, 2), 'utf-8');
      }

      log.info(`Saved export to: ${destPath}`);
      return { path: destPath, success: true };
    } catch (error) {
      log.error('Error saving temp export:', error);
      return { error: error.message };
    }
  });

  /**
   * Delete a temporary file
   */
  ipcMain.handle('file:deleteTempFile', async (event, filePath) => {
    try {
      // Safety check: only delete files in temp directory
      const tempDir = app.getPath('temp');
      if (!filePath.startsWith(tempDir)) {
        return { error: 'Can only delete files in temp directory' };
      }

      await fs.unlink(filePath);
      log.info(`Deleted temp file: ${filePath}`);
      return { success: true };
    } catch (error) {
      // Ignore if file doesn't exist
      if (error.code === 'ENOENT') {
        return { success: true };
      }
      log.error('Error deleting temp file:', error);
      return { error: error.message };
    }
  });

  /**
   * Get the count of lines in a file (for progress tracking)
   */
  ipcMain.handle('file:getLineCount', async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const count = content.split('\n').filter(line => line.trim()).length;
      return { count };
    } catch (error) {
      log.error('Error getting line count:', error);
      return { error: error.message, count: 0 };
    }
  });

  /**
   * Read a sample of lines from the temp file (for preview)
   */
  ipcMain.handle('file:readSample', async (event, filePath, maxLines = 10) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const sample = lines.slice(0, maxLines).map(line => JSON.parse(line));
      return {
        sample,
        totalCount: lines.length,
        hasMore: lines.length > maxLines
      };
    } catch (error) {
      log.error('Error reading sample:', error);
      return { error: error.message };
    }
  });
}

module.exports = {
  registerFileHandlers
};
