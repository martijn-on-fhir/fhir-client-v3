const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;

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
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
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
      console.error('Error opening file:', error);
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
      console.error('Error saving file:', error);
      return { error: error.message };
    }
  });
}

module.exports = {
  registerFileHandlers
};
