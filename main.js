const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray;

// Custom CSS injected into Google Voice
const customCSS = `
  /* Hide promo banners */
  .gv-promo-banner { display: none !important; }

  /* Example: Custom sidebar background */
  mat-nav-list {
    background-color: #1a1c1e !important;
  }
`;

function createDynamicIcon(count) {
  const width = 16;
  const height = 16;
  const buffer = Buffer.alloc(width * height * 4);

  // Grey (#808080) for 0 unread; Bright Google Voice Green (#00C853) for >0
  const hex = count > 0 ? '#00C853' : '#808080';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Anti-aliased circle scaled up to fill the 16x16 canvas
  const centerX = 7.5;
  const centerY = 7.5;
  const radius = 7.8;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      if (dist <= radius) {
        let alpha = 255;
        if (dist > radius - 1) {
          alpha = Math.round((radius - dist) * 255);
        }
        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = alpha;
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width, height });
}

const domPollerScript = `
  setInterval(() => {
    let unreadCount = 0;
    const targets = ['sidenav-messages', 'sidenav-voicemail'];
    
    targets.forEach(testId => {
      const navItem = document.querySelector(\`[gv-test-id="\${testId}"]\`);
      if (navItem) {
        const badge = navItem.querySelector('.mat-badge-content:not(.mat-badge-hidden)');
        if (badge && badge.textContent) {
          const val = parseInt(badge.textContent.trim(), 10);
          if (!isNaN(val)) unreadCount += val;
        }
      }
    });

    if (window.electronAPI) {
      window.electronAPI.sendUnreadCount(unreadCount);
    }
  }, 1000);
`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    title: "Google Voice",
    icon: createDynamicIcon(0),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:google_voice_session'
    }
  });

  mainWindow.loadURL('https://voice.google.com/');

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(customCSS);
    mainWindow.webContents.executeJavaScript(domPollerScript);
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  tray = new Tray(createDynamicIcon(0));
  tray.setToolTip('Google Voice');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Google Voice', click: () => mainWindow.show() },
    { type: 'separator' },
    { 
      label: 'Quit App', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

ipcMain.on('update-unread-count', (event, count) => {
  if (!tray) return;

  tray.setImage(createDynamicIcon(count));
  if (count > 0) {
    tray.setToolTip(\`Google Voice: \${count} unread\`);
  } else {
    tray.setToolTip('Google Voice - No unread messages');
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
  });
}

app.on('window-all-closed', (e) => e.preventDefault());
