// Lists what the unread pollers would match on the live Voice and Chat pages,
// so selectors can be fixed from real markup instead of guesses.
//
// 1. Start the app with a debugging port:  npx electron . --remote-debugging-port=9333
// 2. Run:  node tools/inspect-unread.js [port]
//
// Prints each page's title and every element whose aria-label contains "unread"
// (tag, role, label, whether it's visible). It reads labels only, not message text.

// 3. Optional: node tools/inspect-unread.js 9333 main.js
//    also runs the pollers from that main.js on each page (without touching the
//    tray) and prints what they would report, to test a selector change live.

const fs = require('fs');
const port = process.argv[2] || '9333';
const mainJs = process.argv[3];

// Turns a poller script from main.js into a one-shot expression that returns
// what it would send to the tray, instead of sending it.
function dryRun(name) {
  const src = fs.readFileSync(mainJs, 'utf8');
  const literal = src.match(new RegExp('const ' + name + ' = (`[\\s\\S]*?`);'))[1];
  const script = eval(literal)
    .replace(/window\.electronAPI/g, '__api')
    .replace(/window\.__gvtCheckUnread/g, '__check')
    .replace(/setInterval\([^;]*\);/g, '');
  return `(() => { const sent = []; const __api = {
    sendUnreadCounts: (m, v) => sent.push({ messages: m, voicemail: v }),
    sendChatUnreadCount: (c) => sent.push({ chat: c }) };
    let __check; ${script}; return JSON.stringify(sent); })()`;
}

const probe = `(() => {
  const els = [...document.querySelectorAll('[aria-label*="unread" i], [data-unread="true"]')];
  return JSON.stringify({
    title: document.title,
    url: location.href,
    matches: els.slice(0, 40).map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      label: (el.getAttribute('aria-label') || '').slice(0, 120),
      dataUnread: el.getAttribute('data-unread'),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    })),
    total: els.length
  });
})()`;

async function evaluate(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const result = await new Promise((resolve) => {
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1) resolve(msg.result);
    };
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  ws.close();
  return result.result.value;
}

(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  for (const t of targets.filter((x) => x.type === 'page' && /google\.com/.test(x.url))) {
    console.log(`\n=== ${t.url}`);
    console.log(JSON.stringify(JSON.parse(await evaluate(t.webSocketDebuggerUrl, probe)), null, 2));
    if (mainJs) {
      const poller = /chat\.google/.test(t.url) ? 'chatUnreadPollerScript' : 'domPollerScript';
      console.log(`${poller} would report:`, await evaluate(t.webSocketDebuggerUrl, dryRun(poller)));
    }
  }
})().catch((error) => {
  console.error('Probe failed (is the app running with --remote-debugging-port?):', error.message);
  process.exit(1);
});
