const { Menu, BrowserWindow, shell} = require('electron');

/**
 * Create application menu
 */
function createApplicationMenu() {
  const template = [];

  // Add macOS-specific menu items
  if (process.platform === 'darwin') {

    template.push({
      label: 'FHIR Client',
      submenu: [
        {
          label: 'About FHIR Client',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('show-about');
            }
          }
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // File menu
    template.push({
      label: 'File',
      submenu: [
        {
          label: 'Open file',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('file-open');
            }
          }
        },
        {
          label: 'Save file as',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('file-save');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('show-settings');
            }
          }
        },
        {
          label: 'Certificate Manager',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('show-certificate-manager');
            }
          }
        }
      ]
    });

    // Edit menu
    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    });

    // View menu
    template.push({
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    });

    // Window menu
    template.push({
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    });
  } else {
    // Windows/Linux menus
    template.push({
      label: 'File',
      submenu: [
        {
          label: 'Open file',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('file-open');
            }
          }
        },
        {
          label: 'Save file as',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('file-save');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('show-settings');
            }
          }
        },
        {
          label: 'Certificate Manager',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('show-certificate-manager');
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    });

    template.push({
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    });
  }

  // Add Help menu at the end
  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'Simplifier',
        accelerator: 'CmdOrCtrl+F8',
        click: async () => {
          await shell.openExternal('https://simplifier.net/');
        },
      },
      {
        label: 'Hl7 Fhir',
        click: async () => {
          await shell.openExternal('https://hl7.org/fhir/STU3/index.html');
        },
      },
      { type: 'separator' },
      {
        label: 'Server Info',
        click: () => {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) {
            focusedWindow.webContents.send('show-server-info');
          }
        }
      },
      {
        label: 'About',
        click: () => {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) {
            focusedWindow.webContents.send('show-about');
          }
        }
      }
    ]
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = {
  createApplicationMenu
};
