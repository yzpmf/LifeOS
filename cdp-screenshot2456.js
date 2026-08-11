const WebSocket = require('ws');
const fs = require('fs');
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('2456'));
  if (!page) { console.log('page not found'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.on('open', () => ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot' })));
  ws.on('message', d => {
    const m = JSON.parse(d);
    if (m.id === 1 && m.result && m.result.data) {
      fs.writeFileSync('D:/lifeos/lifeos-2456.png', Buffer.from(m.result.data, 'base64'));
      console.log('saved'); ws.close(); process.exit(0);
    }
  });
  setTimeout(() => { console.log('timeout'); ws.close(); process.exit(1); }, 5000);
})();
