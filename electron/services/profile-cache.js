/**
 * Profile Cache Service
 *
 * Provides disk-based caching for FHIR StructureDefinition profiles.
 * Caches profile data to speed up loading and reduce server requests.
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const log = require('electron-log/main');

class ProfileCacheService {

  constructor() {

    this.cacheDir = path.join(app.getPath('userData'), 'profile-cache');
    this.ensureCacheDir();
  }

  /**
   * Ensure cache directory exists
   */
  async ensureCacheDir() {

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      log.error('[ProfileCache] Error creating cache directory:', error);
    }
  }

  /**
   * Get sanitized filename for profile
   * @param {string} title - Profile title/key
   * @returns {string} Safe filename
   */
  getSafeFilename(title) {
    // Replace invalid filename characters with underscores
    return title.replace(/[<>:"/\\|?*]/g, '_') + '.json';
  }

  /**
   * Get cached profile by title
   * @param {string} title - Profile title/key
   * @returns {Promise<Object|null>} Cached profile or null
   */
  async getProfile(title) {

    try {
      const filename = this.getSafeFilename(title);
      const filePath = path.join(this.cacheDir, filename);

      const data = await fs.readFile(filePath, 'utf-8');
      const cached = JSON.parse(data);

      log.info(`[ProfileCache] Cache hit: ${title}`);
      return cached;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        log.error(`[ProfileCache] Error reading cache for ${title}:`, error);
      }
      return null;
    }
  }

  /**
   * Save profile to cache
   * @param {string} title - Profile title/key
   * @param {Object} data - Profile data to cache
   * @returns {Promise<void>}
   */
  async setProfile(title, data) {

    try {
      await this.ensureCacheDir();

      const filename = this.getSafeFilename(title);
      const filePath = path.join(this.cacheDir, filename);

      const cacheData = {
        ...data,
        cachedAt: new Date().toISOString(),
      };

      await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2), 'utf-8');

    } catch (error) {
      log.error(`[ProfileCache] Error caching ${title}:`, error);
      throw error;
    }
  }

  /**
   * Clear all cached profiles
   * @returns {Promise<void>}
   */
  async clearCache() {

    try {
      const files = await fs.readdir(this.cacheDir);

      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );

      log.info(`[ProfileCache] Cleared ${files.length} cached profiles`);
    } catch (error) {
      log.error('[ProfileCache] Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache stats (fileCount, totalSize)
   */
  async getCacheStats() {

    try {
      await this.ensureCacheDir();
      const files = await fs.readdir(this.cacheDir);

      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch (error) {
          // Skip files that can't be accessed
          log.warn(`[ProfileCache] Could not stat file ${file}:`, error);
        }
      }

      return {
        fileCount: files.length,
        totalSize: totalSize,
      };

    } catch (error) {
      log.error('[ProfileCache] Error getting cache stats:', error);
      return {
        fileCount: 0,
        totalSize: 0,
      };
    }
  }
}

module.exports = { ProfileCacheService };
