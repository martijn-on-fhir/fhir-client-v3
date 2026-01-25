const { safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = require('electron-log/main');

/**
 * Secure Key Manager using Electron's safeStorage API
 *
 * Uses OS-level credential storage (Windows DPAPI, macOS Keychain, Linux Secret Service)
 * to securely store encryption keys for electron-store instances.
 *
 * Keys are generated per-installation and stored encrypted using the OS credential system.
 */

// Key storage location in user data directory
let keyStorePath = null;

// Cache for decrypted keys (kept in memory during app lifetime)
const keyCache = new Map();

// Key identifiers
const KEY_IDS = {
  TOKENS: 'fhir-tokens-key',
  ACCOUNTS: 'fhir-accounts-key',
  PROFILES: 'fhir-profiles-key',
  SESSIONS: 'fhir-sessions-key',
  CERTIFICATES: 'fhir-certificates-key'
};

/**
 * Initialize the secure key manager
 * Must be called after app.whenReady() to ensure safeStorage is available
 * @param {string} userDataPath - Path to user data directory (app.getPath('userData'))
 */
function initialize(userDataPath) {
  keyStorePath = path.join(userDataPath, 'secure-keys.dat');
  log.info('[SecureKeyManager] Initialized with path:', keyStorePath);

  // Check if safeStorage is available
  if (!safeStorage.isEncryptionAvailable()) {
    log.warn('[SecureKeyManager] OS-level encryption not available, using fallback');
  }
}

/**
 * Generate a cryptographically secure random key
 * @returns {string} 32-byte hex-encoded key
 */
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Load keys from encrypted storage file
 * @returns {Object} Map of keyId -> encrypted key buffer
 */
function loadKeyStore() {
  try {
    if (fs.existsSync(keyStorePath)) {
      const data = fs.readFileSync(keyStorePath);
      return JSON.parse(data.toString());
    }
  } catch (error) {
    log.error('[SecureKeyManager] Failed to load key store:', error.message);
  }
  return {};
}

/**
 * Save keys to encrypted storage file
 * @param {Object} keyStore - Map of keyId -> encrypted key (base64)
 */
function saveKeyStore(keyStore) {
  try {
    const dir = path.dirname(keyStorePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(keyStorePath, JSON.stringify(keyStore, null, 2));
    log.info('[SecureKeyManager] Key store saved');
  } catch (error) {
    log.error('[SecureKeyManager] Failed to save key store:', error.message);
    throw error;
  }
}

/**
 * Get or create an encryption key for a specific store
 * Keys are encrypted using OS-level safeStorage and cached in memory
 * @param {string} keyId - Identifier for the key
 * @returns {string} Decrypted encryption key
 */
function getEncryptionKey(keyId) {
  // Check cache first
  if (keyCache.has(keyId)) {
    return keyCache.get(keyId);
  }

  const keyStore = loadKeyStore();

  if (keyStore[keyId]) {
    // Decrypt existing key
    try {
      const encryptedBuffer = Buffer.from(keyStore[keyId], 'base64');

      if (safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(encryptedBuffer);
        keyCache.set(keyId, decrypted);
        log.info(`[SecureKeyManager] Loaded existing key: ${keyId}`);
        return decrypted;
      } else {
        // Fallback: key is stored with basic obfuscation (not secure, but better than plaintext)
        const deobfuscated = deobfuscateKey(keyStore[keyId]);
        keyCache.set(keyId, deobfuscated);
        log.warn(`[SecureKeyManager] Loaded key with fallback (no OS encryption): ${keyId}`);
        return deobfuscated;
      }
    } catch (error) {
      log.error(`[SecureKeyManager] Failed to decrypt key ${keyId}:`, error.message);
      // Key corrupted or OS credentials changed, generate new key
      log.warn(`[SecureKeyManager] Regenerating key: ${keyId}`);
    }
  }

  // Generate new key
  const newKey = generateKey();

  // Encrypt and store
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(newKey);
    keyStore[keyId] = encrypted.toString('base64');
  } else {
    // Fallback: basic obfuscation (warns user that security is reduced)
    keyStore[keyId] = obfuscateKey(newKey);
    log.warn(`[SecureKeyManager] Created key with fallback obfuscation (reduced security): ${keyId}`);
  }

  saveKeyStore(keyStore);
  keyCache.set(keyId, newKey);
  log.info(`[SecureKeyManager] Generated new key: ${keyId}`);

  return newKey;
}

/**
 * Basic obfuscation for fallback when safeStorage unavailable
 * NOT secure - just prevents casual inspection
 * @param {string} key - Key to obfuscate
 * @returns {string} Obfuscated key
 */
function obfuscateKey(key) {
  // XOR with a fixed pattern and base64 encode
  const pattern = 'fhir-client-fallback-not-secure';
  let result = '';
  for (let i = 0; i < key.length; i++) {
    result += String.fromCharCode(key.charCodeAt(i) ^ pattern.charCodeAt(i % pattern.length));
  }
  return Buffer.from(result).toString('base64') + ':fallback';
}

/**
 * Reverse basic obfuscation
 * @param {string} obfuscated - Obfuscated key
 * @returns {string} Original key
 */
function deobfuscateKey(obfuscated) {
  if (!obfuscated.endsWith(':fallback')) {
    throw new Error('Invalid fallback key format');
  }
  const encoded = obfuscated.slice(0, -9);
  const decoded = Buffer.from(encoded, 'base64').toString();
  const pattern = 'fhir-client-fallback-not-secure';
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ pattern.charCodeAt(i % pattern.length));
  }
  return result;
}

/**
 * Check if OS-level encryption is available
 * @returns {boolean} True if safeStorage encryption is available
 */
function isSecureStorageAvailable() {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Clear all cached keys (for logout/security purposes)
 */
function clearCache() {
  keyCache.clear();
  log.info('[SecureKeyManager] Key cache cleared');
}

/**
 * Delete all stored keys (for complete reset)
 */
function deleteAllKeys() {
  try {
    if (fs.existsSync(keyStorePath)) {
      fs.unlinkSync(keyStorePath);
      log.info('[SecureKeyManager] All keys deleted');
    }
    keyCache.clear();
  } catch (error) {
    log.error('[SecureKeyManager] Failed to delete keys:', error.message);
    throw error;
  }
}

/**
 * Get encryption key for tokens store
 * @returns {string} Encryption key
 */
function getTokensKey() {
  return getEncryptionKey(KEY_IDS.TOKENS);
}

/**
 * Get encryption key for accounts store
 * @returns {string} Encryption key
 */
function getAccountsKey() {
  return getEncryptionKey(KEY_IDS.ACCOUNTS);
}

/**
 * Get encryption key for profiles store
 * @returns {string} Encryption key
 */
function getProfilesKey() {
  return getEncryptionKey(KEY_IDS.PROFILES);
}

/**
 * Get encryption key for sessions store
 * @returns {string} Encryption key
 */
function getSessionsKey() {
  return getEncryptionKey(KEY_IDS.SESSIONS);
}

/**
 * Get encryption key for certificates store
 * @returns {string} Encryption key
 */
function getCertificatesKey() {
  return getEncryptionKey(KEY_IDS.CERTIFICATES);
}

module.exports = {
  initialize,
  isSecureStorageAvailable,
  clearCache,
  deleteAllKeys,
  getTokensKey,
  getAccountsKey,
  getProfilesKey,
  getSessionsKey,
  getCertificatesKey,
  KEY_IDS
};
