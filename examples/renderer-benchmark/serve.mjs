import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = process.cwd();
const defaultPath = process.argv[2] || '/examples/webgpu-benchmark/';
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = normalize(decoded === '/' ? defaultPath : decoded).replace(/^(\.\.[/\\])+/, '');
  const absolute = resolve(root, `.${normalized}`);
  if (!absolute.startsWith(root)) return null;
  if (existsSync(absolute) && statSync(absolute).isDirectory()) {
    return join(absolute, 'index.html');
  }
  return absolute;
}

const server = createServer((req, res) => {
  if ((req.url || '').startsWith('/favicon.ico')) {
    res.writeHead(204, { 'cache-control': 'no-store' });
    res.end();
    return;
  }

  const filePath = resolveRequestPath(req.url || '/');
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`Loom3 renderer benchmark server: http://localhost:${port}${defaultPath}`);
});
