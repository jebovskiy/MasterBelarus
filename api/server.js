// Placeholder bootstrap. Real Express + telegraf wiring arrives in Sprint 1.
const http = require('http');

const port = process.env.PORT || 3000;
const health = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'masterby-api', t: Date.now() }));
  }
  res.writeHead(404);
  res.end('not found');
});

health.listen(port, () => {
  console.log(`[masterby-api] listening on :${port}`);
});
