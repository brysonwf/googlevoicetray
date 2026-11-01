// Live check of two preload.js features on the real Voice page, without
// touching any conversation:
//   1. Hotkeys off: a real "z" key press with nothing focused must not reach
//      the page's own listeners.
//   2. Attachment grow: clicking a fake 1600x1000 picture grows the window;
//      a fake full-size viewer keeps it big; removing the viewer restores it.
//
// 1. Start the app (only one copy can run):  npx electron . --remote-debugging-port=9333
// 2. Run:  node tools/test-hotkeys-attachments.js [port]

const port = process.argv[2] || '9333';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  return { ws, send, run };
}

(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const voice = targets.find((t) => t.type === 'page' && /voice\.google\.com/.test(t.url));
  if (!voice) throw new Error('Voice page not found');
  const { ws, send, run } = await connect(voice.webSocketDebuggerUrl);
  const size = () => run('`${innerWidth}x${innerHeight}`');
  let failed = 0;
  const check = (name, ok, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
    if (!ok) failed++;
  };

  // 1. Hotkeys
  await run(`document.activeElement && document.activeElement.blur();
    window.__gvtKeySeen = 0;
    document.addEventListener('keydown', (e) => { if (e.key === 'z') window.__gvtKeySeen++; });`);
  for (const type of ['keyDown', 'char', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key: 'z', text: type === 'keyUp' ? undefined : 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  }
  await sleep(300);
  const seen = await run('window.__gvtKeySeen');
  check('plain key kept from Voice', seen === 0, `page saw "z" ${seen} time(s)`);

  // 2. Attachment grow / restore
  const before = await size();
  const thumb = await run(`(() => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
    const g = c.getContext('2d'); g.fillStyle = '#4a90d9'; g.fillRect(0, 0, 1600, 1000);
    const img = new Image(); img.id = 'gvt-test-thumb'; img.src = c.toDataURL();
    Object.assign(img.style, { position: 'fixed', left: '40px', top: '200px', width: '200px', height: '125px', zIndex: 99999 });
    document.body.appendChild(img);
    return new Promise((resolve) => img.onload = () => {
      const r = img.getBoundingClientRect();
      resolve({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
  })()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: thumb.x, y: thumb.y, button: 'left', clickCount: 1 });
  }
  await sleep(300);
  await run(`(() => {
    const v = document.getElementById('gvt-test-thumb').cloneNode();
    v.id = 'gvt-test-viewer';
    Object.assign(v.style, { left: '0', top: '0', width: '100vw', height: '100vh' });
    document.body.appendChild(v);
  })()`);
  await sleep(1200);
  const grown = await size();
  await sleep(2500);
  const stillGrown = await size();
  await run(`document.getElementById('gvt-test-viewer').remove(); document.getElementById('gvt-test-thumb').remove();`);
  await sleep(2500);
  const after = await size();

  const area = (s) => s.split('x').reduce((a, b) => a * b, 1);
  check('window grows on attachment click', area(grown) > area(before) * 2, `${before} -> ${grown}`);
  check('stays big while viewer is open', stillGrown === grown, `${stillGrown}`);
  check('restores when viewer closes', after === before, `${grown} -> ${after}`);

  ws.close();
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error('Test failed to run (is the app running with --remote-debugging-port?):', error.message);
  process.exit(2);
});
