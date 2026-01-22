/**
 * Narrative Templates IPC Handlers
 *
 * Provides IPC communication for narrative template operations
 */

const { ipcMain } = require('electron');
const Handlebars = require('handlebars');
const { NarrativeTemplatesService } = require('../services/narrative-templates');
const log = require('electron-log/main');

// Singleton instance
const narrativeTemplates = new NarrativeTemplatesService();

/**
 * Register narrative template IPC handlers
 */
function registerNarrativeHandlers() {

  /**
   * Get template by name
   */
  ipcMain.handle('narrative-templates:get', async (event, name) => {
    try {
      return await narrativeTemplates.getTemplate(name);
    } catch (error) {
      log.error(`[NarrativeHandler] Error getting template ${name}:`, error);
      return null;
    }
  });

  /**
   * Save template
   */
  ipcMain.handle('narrative-templates:set', async (event, name, content) => {
    try {
      return await narrativeTemplates.setTemplate(name, content);
    } catch (error) {
      log.error(`[NarrativeHandler] Error saving template ${name}:`, error);
      throw error;
    }
  });

  /**
   * Delete template
   */
  ipcMain.handle('narrative-templates:delete', async (event, name) => {
    try {
      return await narrativeTemplates.deleteTemplate(name);
    } catch (error) {
      log.error(`[NarrativeHandler] Error deleting template ${name}:`, error);
      throw error;
    }
  });

  /**
   * List all templates
   */
  ipcMain.handle('narrative-templates:list', async () => {
    try {
      return await narrativeTemplates.listTemplates();
    } catch (error) {
      log.error('[NarrativeHandler] Error listing templates:', error);
      return [];
    }
  });

  /**
   * Get templates directory path
   */
  ipcMain.handle('narrative-templates:getDir', async () => {
    try {
      return narrativeTemplates.getTemplatesDir();
    } catch (error) {
      log.error('[NarrativeHandler] Error getting templates directory:', error);
      return null;
    }
  });

  /**
   * Compile template with data
   * Performs Handlebars compilation in main process to avoid CSP issues
   */
  ipcMain.handle('narrative-templates:compile', async (event, name, data) => {
    try {
      // Get the template content
      const result = await narrativeTemplates.getTemplate(name);

      if (!result?.content) {
        return { success: false, error: 'Template not found' };
      }

      // Compile and execute template with Handlebars
      const template = Handlebars.compile(result.content);
      let html = template(data);

      // Clean up HTML: remove \r\n and normalize whitespace for cleaner JSON output
      html = html
        .replace(/\r\n/g, '')      // Remove Windows line endings
        .replace(/\n/g, '')        // Remove Unix line endings
        .replace(/\s{2,}/g, ' ')   // Collapse multiple spaces to single space
        .trim();                   // Trim leading/trailing whitespace

      return { success: true, html };
    } catch (error) {
      log.error(`[NarrativeHandler] Error compiling template ${name}:`, error);
      return { success: false, error: error.message || 'Failed to compile template' };
    }
  });

  log.info('[NarrativeHandler] Narrative template IPC handlers registered successfully');
}

module.exports = { registerNarrativeHandlers };
