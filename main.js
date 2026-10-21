const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let chatWindow;
let messagesTray;
let voicemailTray;
let chatTray;
let activeTab;
let autoOpenEnabled = true;
let previousMessagesCount = 0;
let previousVoicemailCount = 0;
let unreadCountsInitialized = false;
let autoOpenMenuItems = [];
let showTabForAutoOpen;
const topResizeStates = new Map();
const traySettings = {
  voice: true,
  messages: true,
  chat: true
};

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const CHAT_VIEWPORT = { width: MOBILE_VIEWPORT.width * 2, height: MOBILE_VIEWPORT.height };
const TASKBAR_CLEARANCE = 8;
const SCREEN_EDGE_CLEARANCE = 12;
const IPHONE_SE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CHAT_DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MIN_WINDOW_HEIGHT = 320;

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
    autoOpenEnabled = settings.autoOpenEnabled !== false;
    traySettings.voice = settings.traySettings?.voice !== false;
    traySettings.messages = settings.traySettings?.messages !== false;
    traySettings.chat = settings.traySettings?.chat !== false;
  } catch {
    autoOpenEnabled = true;
  }
}

function saveSettings() {
  fs.writeFileSync(getSettingsPath(), JSON.stringify({ autoOpenEnabled, traySettings }, null, 2));
}

function enabledTrayCount() {
  return Object.values(traySettings).filter(Boolean).length;
}

// Custom CSS injected into Google Voice
const customCSS = `
  /* Hide promo banners */
  .gv-promo-banner { display: none !important; }

  /* Give the frameless window a compact Windows drawer edge */
  html,
  body {
    overflow: hidden !important;
  }

  body {
    border: 1px solid rgba(120, 128, 140, 0.7) !important;
    border-radius: 10px !important;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35) !important;
    box-sizing: border-box !important;
  }

  /* Snap unread conversations to the top of the list: the list becomes a flex column and unread
     threads get a negative order. Covers the thread-item component and plain list items, and the
     ways Voice marks a thread unread (an .unread class or an "Unread" aria-label). Only rows the list
     has rendered can move, which in practice is the recent ones. */
  :is(gv-conversation-list, [role="list"], [role="listbox"], .cdk-virtual-scroll-content-wrapper):has(> :is(gv-thread-item, [role="listitem"], [role="option"])) {
    display: flex !important;
    flex-direction: column !important;
  }
  :is(gv-thread-item, [role="listitem"], [role="option"]):has(.unread, [aria-label^="unread" i], [aria-label*=" unread" i]),
  :is(gv-thread-item, [role="listitem"], [role="option"]):is(.unread, [aria-label^="unread" i]) {
    order: -1 !important;
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

function createChatIcon(unreadCount = 0) {
  const width = 16;
  const height = 16;
  const buffer = Buffer.alloc(width * height * 4);
  const color = unreadCount > 0
    ? { r: 0, g: 200, b: 83 }
    : { r: 128, g: 128, b: 128 };

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const edgeDistance = Math.min(x - 1, y - 1, width - 2 - x, height - 2 - y);
      if (edgeDistance >= 0) {
        const idx = (y * width + x) * 4;
        buffer[idx] = color.r;
        buffer[idx + 1] = color.g;
        buffer[idx + 2] = color.b;
        buffer[idx + 3] = 255;
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

const chatUnreadPollerScript = `
  setInterval(() => {
    const title = document.title || '';
    const unreadBadge = document.querySelector('[aria-label*="unread" i], [data-unread="true"]');
    const unreadCount = unreadBadge || /^\\(\\d+\\)/.test(title) ? 1 : 0;

    if (window.electronAPI) window.electronAPI.sendChatUnreadCount(unreadCount);
  }, 1000);
`;

async function enableMobileDeviceMode(window) {
  const debuggerProtocol = window.webContents.debugger;

  try {
    debuggerProtocol.attach('1.3');
    await updateMobileDeviceMetrics(window);
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

async function updateMobileDeviceMetrics(window) {
  if (!window || window.isDestroyed()) return;

  const debuggerProtocol = window.webContents.debugger;
  if (!debuggerProtocol.isAttached()) return;

  const [width, height] = window.getContentSize();
  await debuggerProtocol.sendCommand('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: width,
    screenHeight: height,
    positionX: 0,
    positionY: 0
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: MOBILE_VIEWPORT.width,
    height: MOBILE_VIEWPORT.height,
    useContentSize: true,
    resizable: false,
    frame: false,
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
    enableMobileDeviceMode(mainWindow),
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

  mainWindow.on('resize', () => {
    updateMobileDeviceMetrics(mainWindow).catch((error) => {
      console.warn('Mobile viewport resize failed:', error.message);
    });
  });
}

function positionWindowNearTray(window, tray) {
  if (!window || !tray) return;

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x + Math.round(trayBounds.width / 2),
    y: trayBounds.y + Math.round(trayBounds.height / 2)
  });
  const workArea = display.workArea;
  const [windowWidth, windowHeight] = window.getSize();
  const x = Math.max(
    workArea.x,
    workArea.x + workArea.width - windowWidth - SCREEN_EDGE_CLEARANCE
  );
  const y = Math.max(
    workArea.y,
    workArea.y + workArea.height - windowHeight - TASKBAR_CLEARANCE
  );

  window.setPosition(x, y);
}

function createChatWindow() {
  chatWindow = new BrowserWindow({
    width: CHAT_VIEWPORT.width,
    height: CHAT_VIEWPORT.height,
    useContentSize: true,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    show: false,
    autoHideMenuBar: true,
    title: 'Google Chat',
    icon: createDynamicIcon(0),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:google_chat_session'
    }
  });

  chatWindow.webContents.setUserAgent(CHAT_DESKTOP_USER_AGENT);
  chatWindow.loadURL('https://chat.google.com/');

  chatWindow.webContents.on('did-finish-load', () => {
    chatWindow.webContents.insertCSS(customCSS);
  });

  chatWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      chatWindow.hide();
    }
  });

}

function createTray() {
  [messagesTray, voicemailTray, chatTray].forEach((tray) => {
    if (tray) tray.destroy();
  });
  messagesTray = undefined;
  voicemailTray = undefined;
  chatTray = undefined;
  autoOpenMenuItems = [];

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

  const showTab = (tab) => {
    if (chatWindow && chatWindow.isVisible()) chatWindow.hide();
    if (!mainWindow.isVisible()) positionWindowNearTray(mainWindow, messagesTray || voicemailTray);
    mainWindow.show();
    mainWindow.focus();
    activeTab = tab;
    mainWindow.webContents.executeJavaScript(navigateScript(tab));
  };
  showTabForAutoOpen = showTab;

  const openTab = (tab) => {
    if (mainWindow.isVisible() && activeTab === tab) {
      mainWindow.hide();
      return;
    }

    showTab(tab);
  };

  const toggleAutoOpen = (menuItem) => {
    autoOpenEnabled = menuItem.checked;
    saveSettings();
    autoOpenMenuItems.forEach((item) => {
      item.checked = autoOpenEnabled;
    });
  };

  const toggleTray = (key, menuItem) => {
    if (!menuItem.checked && enabledTrayCount() === 1) {
      menuItem.checked = true;
      return;
    }

    traySettings[key] = menuItem.checked;
    saveSettings();
    createTray();
  };

  const trayVisibilityItems = () => [
    {
      label: 'Google Voice icon',
      type: 'checkbox',
      checked: traySettings.voice,
      click: (menuItem) => toggleTray('voice', menuItem)
    },
    {
      label: 'Google Messages icon',
      type: 'checkbox',
      checked: traySettings.messages,
      click: (menuItem) => toggleTray('messages', menuItem)
    },
    {
      label: 'Google Chat icon',
      type: 'checkbox',
      checked: traySettings.chat,
      click: (menuItem) => toggleTray('chat', menuItem)
    }
  ];

  // Messages Tray Icon
  if (traySettings.messages) messagesTray = new Tray(createDynamicIcon(0));
  if (messagesTray) {
  messagesTray.setToolTip('Google Voice - Messages');

  const messagesMenu = Menu.buildFromTemplate([
    { label: 'Open Messages', click: () => {
      openTab('messages');
    }},
    ...trayVisibilityItems(),
    {
      label: 'Auto-open on new messages',
      type: 'checkbox',
      checked: autoOpenEnabled,
      click: toggleAutoOpen
    },
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
  autoOpenMenuItems.push(messagesMenu.items.find((item) => item.label === 'Auto-open on new messages'));
  }

  // Voicemail Tray Icon
  if (traySettings.voice) voicemailTray = new Tray(createTriangleIcon(0));
  if (voicemailTray) {
  voicemailTray.setToolTip('Google Voice - Voicemail');

  const voicemailMenu = Menu.buildFromTemplate([
    { label: 'Open Voicemail', click: () => {
      openTab('voicemail');
    }},
    ...trayVisibilityItems(),
    {
      label: 'Auto-open on new messages',
      type: 'checkbox',
      checked: autoOpenEnabled,
      click: toggleAutoOpen
    },
    { type: 'separator' },
    { 
      label: 'Quit App', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);

  autoOpenMenuItems.push(voicemailMenu.items.find((item) => item.label === 'Auto-open on new messages'));
  voicemailTray.setContextMenu(voicemailMenu);
  voicemailTray.on('click', () => {
    openTab('voicemail');
  });
  }

  const openChat = () => {
    if (chatWindow.isVisible()) {
      chatWindow.hide();
      return;
    }

    if (mainWindow.isVisible()) mainWindow.hide();
    positionWindowNearTray(chatWindow, chatTray);
    chatWindow.show();
    chatWindow.focus();
  };

  if (traySettings.chat) chatTray = new Tray(createChatIcon());
  if (chatTray) {
  chatTray.setToolTip('Google Chat');
  chatTray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Google Chat', click: openChat },
    ...trayVisibilityItems(),
    { type: 'separator' },
    {
      label: 'Quit App',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]));
  chatTray.on('click', openChat);
  }
}

ipcMain.on('update-unread-counts', (event, messagesCount, voicemailCount) => {
  const newMessagesReceived = messagesCount > 0 && previousMessagesCount === 0;
  previousMessagesCount = messagesCount;
  previousVoicemailCount = voicemailCount;

  if (!unreadCountsInitialized) {
    unreadCountsInitialized = true;
  } else if (autoOpenEnabled && newMessagesReceived && showTabForAutoOpen) {
    showTabForAutoOpen('messages');
  }

  // Update Messages Icon
  if (messagesTray) {
    messagesTray.setImage(createDynamicIcon(messagesCount));
    if (messagesCount > 0) {
      messagesTray.setToolTip(`Google Voice - Messages: ${messagesCount} unread`);
    } else {
      messagesTray.setToolTip('Google Voice - Messages');
    }
  }

  // Update Voicemail Icon
  if (voicemailTray) {
    voicemailTray.setImage(createTriangleIcon(voicemailCount));
    if (voicemailCount > 0) {
      voicemailTray.setToolTip(`Google Voice - Voicemail: ${voicemailCount} unread`);
    } else {
      voicemailTray.setToolTip('Google Voice - Voicemail');
    }
  }
});

ipcMain.on('update-chat-unread-count', (event, unreadCount) => {
  if (!chatTray) return;

  chatTray.setImage(createChatIcon(unreadCount));
  chatTray.setToolTip(unreadCount > 0 ? 'Google Chat: unread messages' : 'Google Chat');
});

ipcMain.on('top-resize-start', (event, screenY) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return;

  const bounds = window.getBounds();
  topResizeStates.set(window.id, {
    startScreenY: screenY,
    startY: bounds.y,
    startHeight: bounds.height
  });
});

ipcMain.on('top-resize-move', (event, screenY) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const resizeState = window && topResizeStates.get(window.id);
  if (!resizeState || window.isDestroyed()) return;

  const delta = screenY - resizeState.startScreenY;
  const height = Math.max(MIN_WINDOW_HEIGHT, resizeState.startHeight - delta);
  const y = resizeState.startY + resizeState.startHeight - height;
  window.setBounds({ y, height }, false);
});

ipcMain.on('top-resize-end', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) topResizeStates.delete(window.id);
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
    loadSettings();
    createWindow();
    createChatWindow();
    createTray();
  });
}

app.on('window-all-closed', (e) => e.preventDefault());
