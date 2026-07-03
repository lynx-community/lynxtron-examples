import fs from 'fs';
import http from 'http';
import path from 'path';

type ListeningMessage = {
  type: 'listening';
  url: string;
  root: string;
};

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function sendNotFound(response: http.ServerResponse) {
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not Found');
}

function sendForbidden(response: http.ServerResponse) {
  response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Forbidden');
}

function resolveRequestPath(rootDir: string, requestPath: string): string | null {
  const normalizedPath = decodeURIComponent(requestPath).replace(/^\/+/, '');
  const candidatePath = path.resolve(rootDir, normalizedPath);
  if (!candidatePath.startsWith(rootDir)) {
    return null;
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
    const directoryIndexPath = path.join(candidatePath, 'index.html');
    if (fs.existsSync(directoryIndexPath) && fs.statSync(directoryIndexPath).isFile()) {
      return directoryIndexPath;
    }
  }

  const spaFallbackPath = path.join(rootDir, 'index.html');
  if (fs.existsSync(spaFallbackPath) && fs.statSync(spaFallbackPath).isFile()) {
    return spaFallbackPath;
  }

  return null;
}

function serveFile(filePath: string, response: http.ServerResponse) {
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  });
  fs.createReadStream(filePath).pipe(response);
}

function notifyListening(url: string, rootDir: string) {
  const message: ListeningMessage = {
    type: 'listening',
    url,
    root: rootDir,
  };
  if (typeof process.send === 'function') {
    process.send(message);
    return;
  }
  console.log(url);
}

function main() {
  const rawRootDir = process.argv[2];
  if (!rawRootDir) {
    throw new Error('Missing dist/web root path');
  }

  const rootDir = path.resolve(rawRootDir);
  const indexPath = path.join(rootDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Built web entry not found: ${indexPath}`);
  }

  const server = http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const resolvedPath = resolveRequestPath(rootDir, requestUrl.pathname);
      if (!resolvedPath) {
        const normalizedPath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
        const candidatePath = path.resolve(rootDir, normalizedPath);
        if (!candidatePath.startsWith(rootDir)) {
          sendForbidden(response);
          return;
        }
        sendNotFound(response);
        return;
      }
      serveFile(resolvedPath, response);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Internal Server Error');
    }
  });

  const closeServer = () => {
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', closeServer);
  process.on('SIGTERM', closeServer);
  process.on('disconnect', closeServer);

  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve listening address');
    }
    const url = `http://127.0.0.1:${address.port}/`;
    notifyListening(url, rootDir);
  });
}

main();
