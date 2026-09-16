const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');

let mainWindow;
let messagesTray;
let voicemailTray;
let activeTab;

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const TASKBAR_CLEARANCE = 8;
const IPHONE_SE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Custom CSS injected into Google Voice
const customCSS = `
  /* Hide promo banners */
  .gv-promo-banner { display: none !important; }

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

async function enableMobileDeviceMode() {
  const debuggerProtocol = mainWindow.webContents.debugger;

  try {
    debuggerProtocol.attach('1.3');
    await debuggerProtocol.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: MOBILE_VIEWPORT.width,
      height: MOBILE_VIEWPORT.height,
      deviceScaleFactor: 2,
      mobile: true,
      screenWidth: MOBILE_VIEWPORT.width,
      screenHeight: MOBILE_VIEWPORT.height,
      positionX: 0,
      positionY: 0
    });
    await debuggerProtocol.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5
    });
    await debuggerProtocol.sendCommand('Emulation.setUserAgentOverride', {
      userAgent: IPHONE_SE_USER_AGENT,
      platform: 'iPhone'
    });
  } catch (error) {
    console.warn('Mobile device emulation is unavailable; using the mobile viewport instead.', error.message);
    if (debuggerProtocol.isAttached()) debuggerProtocol.detach();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: MOBILE_VIEWPORT.width,
    height: MOBILE_VIEWPORT.height,
    useContentSize: true,
    alwaysOnTop: true,
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

  mainWindow.webContents.setUserAgent(IPHONE_SE_USER_AGENT);
  mainWindow.loadURL('https://voice.google.com/');
  Promise.race([
    enableMobileDeviceMode(),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ]).catch((error) => {
    console.warn('Mobile device emulation setup failed:', error.message);
  });

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

function positionWindowNearTray() {
  if (!mainWindow || !messagesTray) return;

  const trayBounds = messagesTray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x + Math.round(trayBounds.width / 2),
    y: trayBounds.y + Math.round(trayBounds.height / 2)
  });
  const workArea = display.workArea;
  const [windowWidth, windowHeight] = mainWindow.getSize();
  const trayCenter = trayBounds.x + Math.round(trayBounds.width / 2);
  const x = Math.max(
    workArea.x,
    Math.min(trayCenter - Math.round(windowWidth / 2), workArea.x + workArea.width - windowWidth)
  );
  const y = Math.max(
    workArea.y,
    workArea.y + workArea.height - windowHeight - TASKBAR_CLEARANCE
  );

  mainWindow.setPosition(x, y);
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

  const openTab = (tab) => {
    if (mainWindow.isVisible() && activeTab === tab) {
      mainWindow.hide();
      return;
    }

    if (!mainWindow.isVisible()) positionWindowNearTray();
    mainWindow.show();
    mainWindow.focus();
    activeTab = tab;
    mainWindow.webContents.executeJavaScript(navigateScript(tab));
  };

  // Messages Tray Icon
  messagesTray = new Tray(createDynamicIcon(0));
  messagesTray.setToolTip('Google Voice - Messages');

  const messagesMenu = Menu.buildFromTemplate([
    { label: 'Open Messages', click: () => {
      openTab('messages');
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
    openTab('messages');
  });

  // Voicemail Tray Icon
  voicemailTray = new Tray(createTriangleIcon(0));
  voicemailTray.setToolTip('Google Voice - Voicemail');

  const voicemailMenu = Menu.buildFromTemplate([
    { label: 'Open Voicemail', click: () => {
      openTab('voicemail');
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
    openTab('voicemail');
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
