const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendUnreadCounts: (messagesCount, voicemailCount) => ipcRenderer.send('update-unread-counts', messagesCount, voicemailCount),
  sendChatUnreadCount: (unreadCount) => ipcRenderer.send('update-chat-unread-count', unreadCount)
});

// Turn off Google Voice's single-key shortcuts (e = archive, # = delete, ...).
// Typing while the message box isn't focused used to archive the thread
// (Bryson 2026-11-01). Preload runs before Voice's scripts, so this capture
// listener fires first. Plain keys typed outside a text field are kept from
// Voice; if a message box is on screen, focus moves there so the typing lands
// in it. Ctrl/Alt/Cmd combos, Enter, Esc, Tab and arrows are untouched.
if (location.hostname === 'voice.google.com') {
  const isEditable = (el) =>
    !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  const findMessageBox = () =>
    [...document.querySelectorAll('textarea, [contenteditable="true"]')].find(
      (el) => !el.disabled && el.getClientRects().length > 0
    );

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return; // only printable keys: letters, digits, symbols, space
    if (isEditable(event.target) || isEditable(document.activeElement)) return;

    event.stopImmediatePropagation();
    const box = findMessageBox();
    if (box) {
      box.focus(); // the key's character is then typed into the box
    } else {
      event.preventDefault(); // nowhere to type: just swallow it
    }
  }, true);
}

// Clicking a photo/video attachment asks main.js to grow the window to fit it
// (Bryson 2026-11-01). Voice's viewer markup is unknown (Claude can't open his
// threads), so "viewer open" means some image/video fills a good part of the
// window. Once none does, the window goes back to normal. Small images
// (contact avatars) are ignored.
if (location.hostname === 'voice.google.com') {
  const MIN_THUMB = 60;          // px: smaller rendered images are avatars/icons
  const VIEWER_SHARE = 0.4;      // media covering ≥40% of the window = viewer open
  let watch = null;

  const isShown = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };

  const viewerOpen = () => {
    const area = window.innerWidth * window.innerHeight;
    return [...document.querySelectorAll('img, video')].some((el) => {
      if (!isShown(el)) return false;
      const r = el.getBoundingClientRect();
      return (r.width * r.height) / area >= VIEWER_SHARE;
    });
  };

  const stopWatch = () => {
    clearInterval(watch);
    watch = null;
    ipcRenderer.send('attachment-close');
  };

  document.addEventListener('click', (event) => {
    if (watch) return;
    const media = event.target.closest && (event.target.closest('img, video') ||
      event.target.querySelector?.('img, video'));
    if (!media || !isShown(media)) return;
    const r = media.getBoundingClientRect();
    if (Math.min(r.width, r.height) < MIN_THUMB) return;

    ipcRenderer.send('attachment-open',
      media.naturalWidth || media.videoWidth || 0,
      media.naturalHeight || media.videoHeight || 0);

    // Give the viewer time to open and the window time to grow, then watch
    // for it closing (two misses in a row, so a reloading image doesn't count).
    const startedAt = Date.now();
    let misses = 0;
    watch = setInterval(() => {
      if (Date.now() - startedAt < 1500) return;
      misses = viewerOpen() ? 0 : misses + 1;
      if (misses >= 2) stopWatch();
    }, 400);
  }, true);
}

const TOP_RESIZE_GRAB_HEIGHT = 8;
let topResizeActive = false;

document.addEventListener('pointermove', (event) => {
  document.documentElement.style.cursor = event.clientY <= TOP_RESIZE_GRAB_HEIGHT ? 'ns-resize' : '';

  if (topResizeActive) {
    ipcRenderer.send('top-resize-move', event.screenY);
  }
});

document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.clientY > TOP_RESIZE_GRAB_HEIGHT) return;

  topResizeActive = true;
  if (event.target.setPointerCapture) event.target.setPointerCapture(event.pointerId);
  ipcRenderer.send('top-resize-start', event.screenY);
  event.preventDefault();
});

document.addEventListener('pointerup', () => {
  if (!topResizeActive) return;

  topResizeActive = false;
  ipcRenderer.send('top-resize-end');
});
