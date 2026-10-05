'use strict';
const crypto = require('crypto');
const session = crypto.randomBytes(32).toString('hex');
const cookieName = 'lifeos_session';
module.exports = function security(req, res, next) {
  const port = req.socket.localPort;
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  const host = String(req.headers.host || '').toLowerCase();
  if (!hosts.has(host)) return res.status(403).json({ error: 'Untrusted host' });
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}`) return res.status(403).json({ error: 'Untrusted origin' });
  if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Cross-site request rejected' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.path.startsWith('/api/')) {
    const m = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='));
    const value = m ? m.slice(cookieName.length + 1) : '';
    const bufValue = Buffer.from(value);
    const bufSession = Buffer.from(session);
    if (bufValue.length !== bufSession.length || !crypto.timingSafeEqual(bufValue, bufSession))
      return res.status(401).json({ error: 'Open LifeOS to initialize this session' });
    res.setHeader('Cache-Control', 'no-store');
  } else if ((req.method === 'GET' || req.method === 'HEAD') && (req.path === '/' || req.path === '/index.html' || req.path === '/webapp/index.html')) {
    res.setHeader('Set-Cookie', `${cookieName}=${session}; Path=/; HttpOnly; SameSite=Strict`);
  }
  if (/^\/(?:data|node_modules)(?:\/|$)/i.test(req.path) || /^\/(?:server|main|preload|desktop-security)\.(?:js|cjs)$/.test(req.path))
    return res.status(404).end();
  next();
};
