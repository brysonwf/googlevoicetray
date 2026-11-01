// Checks that the scripts main.js injects into the Voice/Chat pages parse.
// Usage: node tools/check-injected.js main.js
const s = require('fs').readFileSync(process.argv[2], 'utf8');
for (const name of ['domPollerScript', 'chatUnreadPollerScript']) {
  const lit = s.match(new RegExp('const ' + name + ' = (`[\\s\\S]*?`);'))[1];
  const code = eval(lit);           // the actual string Electron injects
  new Function(code);               // throws on syntax error
  console.log(name, 'OK');
}
