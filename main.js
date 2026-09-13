const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let messagesTray;
let voicemailTray;

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

function createTriangleIcon(count) {
  const width = 16;
  const height = 16;
  const buffer = Buffer.alloc(width * height * 4);

  // Grey (#808080) for 0 unread; Bright Google Voice Green (#00C853) for >0
  const hex = count > 0 ? '#00C853' : '#808080';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Draw upside down triangle
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Upside down triangle: base at top, point at bottom
      const topY = 2;
      const bottomY = 14;
      const leftX = 2;
      const rightX = 14;
      
      // Check if point is inside triangle
      const relY = y - topY;
      const triangleHeight = bottomY - topY;
      
      if (relY >= 0 && relY <= triangleHeight) {
        // Width at this Y level decreases as we go down
        const widthAtY = (rightX - leftX) * (1 - relY / triangleHeight) / 2;
        const centerX = 7.5;
        const minX = centerX - widthAtY;
        const maxX = centerX + widthAtY;
        
        if (x >= minX && x <= maxX) {
          let alpha = 255;
          // Smooth edges
          if (x < minX + 1) {
            alpha = Math.round((x - minX + 1) * 255);
          } else if (x > maxX - 1) {
            alpha = Math.round((maxX - x + 1) * 255);
          }
          
          buffer[idx] = r;
          buffer[idx + 1] = g;
          buffer[idx + 2] = b;
          buffer[idx + 3] = Math.min(alpha, 255);
        }
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width, height });
}

const domPollerScript = `
  setInterval(() => {
    let messagesCount = 0;
    let voicemailCount = 0;
    
    // Get messages count
    const messagesNav = document.querySelector('[gv-test-id="sidenav-messages"]');
    if (messagesNav) {
      const badge = messagesNav.querySelector('.mat-badge-content:not(.mat-badge-hidden)');
      if (badge && badge.textContent) {
        const val = parseInt(badge.textContent.trim(), 10);
        if (!isNaN(val)) messagesCount = val;
      }
    }
    
    // Get voicemail count
    const voicemailNav = document.querySelector('[gv-test-id="sidenav-voicemail"]');
    if (voicemailNav) {
      const badge = voicemailNav.querySelector('.mat-badge-content:not(.mat-badge-hidden)');
      if (badge && badge.textContent) {
        const val = parseInt(badge.textContent.trim(), 10);
        if (!isNaN(val)) voicemailCount = val;
      }
    }

    if (window.electronAPI) {
      window.electronAPI.sendUnreadCounts(messagesCount, voicemailCount);
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
  const navigateScript = (tab) => `
    (() => {
      try {
        // Wait a bit for page to be ready if needed
        const tryClick = () => {
          // Try primary selector
          let nav = document.querySelector('[gv-test-id="sidenav-${tab}"]');
          
          // Try alternative selectors
          if (!nav) {
            const tabLabel = '${tab}' === 'messages' ? 'Messages' : 'Voicemail';
            nav = Array.from(document.querySelectorAll('[role="button"]'))
              .find(el => el.textContent.includes(tabLabel));
          }
          
          if (!nav) {
            nav = Array.from(document.querySelectorAll('a, button, [role="tab"]'))
              .find(el => el.textContent.includes('${tab}' === 'messages' ? 'Messages' : 'Voicemail'));
          }
          
          if (nav) {
            nav.click();
            return true;
          }
          return false;
        };
        
        if (!tryClick() && performance.now() < 5000) {
          setTimeout(tryClick, 500);
        }
      } catch (e) {
        console.error('Navigation error:', e);
      }
    })();
    void 0;
  `;

  // Messages Tray Icon
  messagesTray = new Tray(createDynamicIcon(0));
  messagesTray.setToolTip('Google Voice - Messages');

  const messagesMenu = Menu.buildFromTemplate([
    { label: 'Open Messages', click: () => {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.executeJavaScript(navigateScript('messages'));
    }},
    { type: 'separator' },
    { 
      label: 'Quit App', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);

  messagesTray.setContextMenu(messagesMenu);
  messagesTray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.executeJavaScript(navigateScript('messages'));
  });

  // Voicemail Tray Icon
  voicemailTray = new Tray(createTriangleIcon(0));
  voicemailTray.setToolTip('Google Voice - Voicemail');

  const voicemailMenu = Menu.buildFromTemplate([
    { label: 'Open Voicemail', click: () => {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.executeJavaScript(navigateScript('voicemail'));
    }},
    { type: 'separator' },
    { 
      label: 'Quit App', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);

  voicemailTray.setContextMenu(voicemailMenu);
  voicemailTray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.executeJavaScript(navigateScript('voicemail'));
  });
}

ipcMain.on('update-unread-counts', (event, messagesCount, voicemailCount) => {
  if (!messagesTray || !voicemailTray) return;

  // Update Messages Icon
  messagesTray.setImage(createDynamicIcon(messagesCount));
  if (messagesCount > 0) {
    messagesTray.setToolTip(`Google Voice - Messages: ${messagesCount} unread`);
  } else {
    messagesTray.setToolTip('Google Voice - Messages');
  }

  // Update Voicemail Icon
  voicemailTray.setImage(createTriangleIcon(voicemailCount));
  if (voicemailCount > 0) {
    voicemailTray.setToolTip(`Google Voice - Voicemail: ${voicemailCount} unread`);
  } else {
    voicemailTray.setToolTip('Google Voice - Voicemail');
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
