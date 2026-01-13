const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Configuration IPC Handler
 *
 * Exposes environment configuration to the Angular renderer process
 * This allows Angular to use the same config as Electron without duplication
 */

let cachedConfig = null;

/**
 * Load configuration from external JSON file
 */
function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(__dirname, 'environments.json');
  const examplePath = path.join(__dirname, 'environments.example.json');

  if (!fs.existsSync(configPath)) {
    console.error('[ConfigHandler] ERROR: environments.json not found!');
    console.error(`[ConfigHandler] Please create ${configPath}`);
    console.error(`[ConfigHandler] You can copy from ${examplePath} and fill in your values`);
    return null;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    cachedConfig = JSON.parse(configContent);
    console.log('[ConfigHandler] Configuration loaded successfully');
    return cachedConfig;
  } catch (error) {
    console.error('[ConfigHandler] ERROR: Failed to parse environments.json:', error.message);
    return null;
  }
}

/**
 * Get environments config (without sensitive terminology credentials)
 * Returns only the environment configurations needed by Angular
 */
function getEnvironmentsForRenderer() {
  const config = loadConfig();
  if (!config) {
    return null;
  }

  // Extract only environment configs (exclude terminology which has credentials)
  const { terminology, ...environments } = config;
  return environments;
}

/**
 * Get list of available environment names
 */
function getAvailableEnvironments() {
  const config = loadConfig();
  if (!config) {
    return [];
  }

  // Filter out non-environment keys like 'terminology'
  return Object.keys(config).filter(key => key !== 'terminology');
}

/**
 * Register configuration IPC handlers
 */
function registerConfigHandlers() {
  console.log('[ConfigHandler] Registering configuration IPC handlers');

  /**
   * Get all environment configurations
   */
  ipcMain.handle('config:getEnvironments', async () => {
    const environments = getEnvironmentsForRenderer();
    if (!environments) {
      return { success: false, error: 'Configuration not loaded' };
    }
    return { success: true, environments };
  });

  /**
   * Get list of available environment names
   */
  ipcMain.handle('config:getAvailableEnvironments', async () => {
    const environments = getAvailableEnvironments();
    return { success: true, environments };
  });

  /**
   * Get specific environment configuration
   */
  ipcMain.handle('config:getEnvironment', async (event, envName) => {
    const environments = getEnvironmentsForRenderer();
    if (!environments) {
      return { success: false, error: 'Configuration not loaded' };
    }

    const envConfig = environments[envName];
    if (!envConfig) {
      return { success: false, error: `Environment '${envName}' not found` };
    }

    return { success: true, environment: envConfig };
  });

  console.log('[ConfigHandler] Configuration IPC handlers registered successfully');
}

module.exports = { registerConfigHandlers, loadConfig };
