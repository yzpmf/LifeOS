const WebSocket = require('ws');
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('2456'));
  if (!page) { console.log('page not found'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: 'document.body.innerHTML.slice(0,2000)' } }));
  });
  ws.on('message', d => {
    const m = JSON.parse(d);
    console.log(JSON.stringify(m).slice(0,2000));
    if (m.id === 2) {
      ws.close(); process.exit(0);
    }
  });
  setTimeout(() => { console.log('timeout'); ws.close(); process.exit(1); }, 5000);
})();
