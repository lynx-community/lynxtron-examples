// Deterministic, local-only web content for the real CEF interaction checks.
import { createServer } from 'node:http';

createServer((request, response) => {
  const second = request.url === '/second';
  const title = second ? 'Browser smoke B' : 'Browser smoke A';
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`<!doctype html><title>${title}</title>
    <style>body{font:24px sans-serif;background:#e8f5e9;padding:48px}a{display:block;margin:24px 0}</style>
    <h1>${title}</h1><p>CEF rendering and navigation test.</p>
    <a href="${second ? '/' : '/second'}">${second ? 'Back to A' : 'Go to B'}</a>
    <a href="/second" target="_blank">Open B in a new tab</a>
    <p>Load timestamp: ${Date.now()}</p>`);
}).listen(18743, '127.0.0.1', () => console.log('Browser smoke fixture: http://127.0.0.1:18743'));
