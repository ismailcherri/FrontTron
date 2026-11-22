import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import RoomRepository from './engine/server/repository/RoomRepository.js';
import RoomsController from './engine/server/controller/RoomsController.js';
import { Session } from './session.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

export function createGameServer(options = {}) {
  const repository = new RoomRepository();
  const lobby = new RoomsController(repository);
  const server = createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405).end();
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/healthz')
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok"}');
      if (pathname === '/config.json') {
        return res
          .writeHead(200, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ analytics: options.analytics ?? 'GTM-W8X5XVH5' }));
      }
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + sep) || !types[extname(file)]) return res.writeHead(404).end();
      const info = await stat(file);
      if (!info.isFile()) return res.writeHead(404).end();
      res.writeHead(200, {
        'Content-Type': types[extname(file)],
        'Content-Length': info.size,
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end();
    }
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });
  let sequence = 0;
  wss.on('connection', (socket) => {
    lobby.attach(new Session(++sequence, socket));
  });
  return { server, repository, wss };
}
