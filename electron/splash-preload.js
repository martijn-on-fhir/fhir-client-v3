const { contextBridge } = require('electron');
const path = require('path');
const fs = require('fs');

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Expose version to splash screen
contextBridge.exposeInMainWorld('appVersion', packageJson.version);
