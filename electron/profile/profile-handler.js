/**
 * Profile Cache IPC Handlers
 *
 * Provides IPC communication for profile caching operations
 */

const { ipcMain } = require('electron');
const { ProfileCacheService } = require('../services/profile-cache');
const log = require('electron-log/main');

// Singleton instance
const profileCache = new ProfileCacheService();

/**
 * Register profile cache IPC handlers
 */
function registerProfileHandlers() {

  /**
   * Get cached profile by title
   */
  ipcMain.handle('profile-cache:get-profile', async (event, title) => {
    try {
      return await profileCache.getProfile(title);
    } catch (error) {
      log.error(`[ProfileHandler] Error getting profile ${title}:`, error);
      return null;
    }
  });

  /**
   * Save profile to cache
   */
  ipcMain.handle('profile-cache:set-profile', async (event, title, data) => {

    try {
      await profileCache.setProfile(title, data);
      return { success: true };
    } catch (error) {
      log.error(`[ProfileHandler] Error setting profile ${title}:`, error);
      throw error;
    }
  });

  /**
   * Clear all cached profiles
   */
  ipcMain.handle('profile-cache:clear', async () => {

    try {
      await profileCache.clearCache();
      return { success: true };
    } catch (error) {
      log.error('[ProfileHandler] Error clearing cache:', error);
      throw error;
    }
  });

  /**
   * Get cache statistics
   */
  ipcMain.handle('profile-cache:stats', async () => {

    try {
      return await profileCache.getCacheStats();
    } catch (error) {
      log.error('[ProfileHandler] Error getting cache stats:', error);
      return {
        fileCount: 0,
        totalSize: 0,
      };
    }
  });

  log.info('[ProfileHandler] Profile cache IPC handlers registered successfully');
}

module.exports = { registerProfileHandlers };
