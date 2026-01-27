/**
 * Narrative Templates Service
 *
 * Provides disk-based storage for Handlebars (.hbs) templates.
 * Templates are stored in the user data directory and can be
 * retrieved by profile name.
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const log = require('electron-log/main');

class NarrativeTemplatesService {

  constructor() {
    this.templatesDir = path.join(app.getPath('userData'), 'narrative-templates');
    this.ensureTemplatesDir();
  }

  /**
   * Ensure templates directory exists
   */
  async ensureTemplatesDir() {
    try {
      await fs.mkdir(this.templatesDir, { recursive: true });
      log.info(`[NarrativeTemplates] Templates directory: ${this.templatesDir}`);
    } catch (error) {
      log.error('[NarrativeTemplates] Error creating templates directory:', error);
    }
  }

  /**
   * Get sanitized filename for template
   * Security: Prevents path traversal attacks by:
   * 1. Replacing invalid filename characters
   * 2. Removing path separators and parent directory references
   * 3. Ensuring the filename stays within templatesDir
   *
   * @param {string} name - Template name (profile name)
   * @returns {string} Safe filename with .hbs extension
   */
  getSafeFilename(name) {
    // First, replace invalid filename characters with underscores
    let safe = name.replace(/[<>:"/\\|?*]/g, '_');

    // Remove any remaining path separators and parent directory references
    safe = safe.replace(/\.\./g, '').replace(/[/\\]/g, '_');

    // Remove leading/trailing dots and spaces
    safe = safe.replace(/^[\s.]+|[\s.]+$/g, '');

    // Ensure we have a valid filename (fallback to 'template' if empty)
    if (!safe || safe.length === 0) {
      safe = 'template';
    }

    return safe + '.hbs';
  }

  /**
   * Validate that a path is within the templates directory
   * @param {string} filePath - Path to validate
   * @returns {boolean} True if path is safe
   */
  isPathSafe(filePath) {
    const resolvedPath = path.resolve(filePath);
    const resolvedTemplatesDir = path.resolve(this.templatesDir);
    return resolvedPath.startsWith(resolvedTemplatesDir + path.sep) ||
           resolvedPath === resolvedTemplatesDir;
  }

  /**
   * Get template by name
   * @param {string} name - Template name (profile name)
   * @returns {Promise<{content: string, path: string}|null>} Template content or null
   */
  async getTemplate(name) {
    try {
      const filename = this.getSafeFilename(name);
      const filePath = path.join(this.templatesDir, filename);

      // Security: Verify path is within templates directory
      if (!this.isPathSafe(filePath)) {
        log.warn(`[NarrativeTemplates] Path traversal attempt blocked: ${name}`);
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');

      log.info(`[NarrativeTemplates] Template found: ${name}`);
      return {
        content,
        path: filePath
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        log.error(`[NarrativeTemplates] Error reading template ${name}:`, error);
      }
      return null;
    }
  }

  /**
   * Save template
   * @param {string} name - Template name (profile name)
   * @param {string} content - Template content
   * @returns {Promise<{success: boolean, path: string}>}
   */
  async setTemplate(name, content) {
    try {
      await this.ensureTemplatesDir();

      const filename = this.getSafeFilename(name);
      const filePath = path.join(this.templatesDir, filename);

      // Security: Verify path is within templates directory
      if (!this.isPathSafe(filePath)) {
        log.warn(`[NarrativeTemplates] Path traversal attempt blocked on save: ${name}`);
        throw new Error('Invalid template name');
      }

      await fs.writeFile(filePath, content, 'utf-8');

      log.info(`[NarrativeTemplates] Template saved: ${name}`);
      return { success: true, path: filePath };
    } catch (error) {
      log.error(`[NarrativeTemplates] Error saving template ${name}:`, error);
      throw error;
    }
  }

  /**
   * Delete template
   * @param {string} name - Template name (profile name)
   * @returns {Promise<{success: boolean}>}
   */
  async deleteTemplate(name) {
    try {
      const filename = this.getSafeFilename(name);
      const filePath = path.join(this.templatesDir, filename);

      // Security: Verify path is within templates directory
      if (!this.isPathSafe(filePath)) {
        log.warn(`[NarrativeTemplates] Path traversal attempt blocked on delete: ${name}`);
        throw new Error('Invalid template name');
      }

      await fs.unlink(filePath);

      log.info(`[NarrativeTemplates] Template deleted: ${name}`);
      return { success: true };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true }; // Already doesn't exist
      }
      log.error(`[NarrativeTemplates] Error deleting template ${name}:`, error);
      throw error;
    }
  }

  /**
   * List all templates
   * @returns {Promise<Array<{name: string, filename: string}>>}
   */
  async listTemplates() {
    try {
      await this.ensureTemplatesDir();
      const files = await fs.readdir(this.templatesDir);

      const templates = files
        .filter(file => file.endsWith('.hbs'))
        .map(file => ({
          name: file.replace('.hbs', '').replace(/_/g, ' '),
          filename: file
        }));

      return templates;
    } catch (error) {
      log.error('[NarrativeTemplates] Error listing templates:', error);
      return [];
    }
  }

  /**
   * Get templates directory path
   * @returns {string}
   */
  getTemplatesDir() {
    return this.templatesDir;
  }
}

module.exports = { NarrativeTemplatesService };
