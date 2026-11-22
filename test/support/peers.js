import { once, EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { createGameServer } from '../../server/server.js';

export class Peer {
  log = [];
  events = new EventEmitter();
  number = 0;
  constructor(url) {
    this.socket = new WebSocket(url);
    this.socket.on('message', (raw) => {
      for (const item of JSON.parse(raw)) {
        this.log.push(item);
        this.events.emit('update');
      }
    });
  }
  send(name, data) {
    this.socket.send(JSON.stringify([[name, data]]));
  }
  async request(name, data) {
    const request = ++this.number;
    this.socket.send(JSON.stringify([[name, data, request]]));
    return this.wait(request);
  }
  async wait(name, predicate = () => true) {
    const end = AbortSignal.timeout(16000);
    while (true) {
      const idx = this.log.findIndex(([k, v]) => k === name && predicate(v));
      if (idx !== -1) return this.log.splice(idx, 1)[0][1];
      try {
        await once(this.events, 'update', { signal: end });
      } catch (cause) {
        throw new Error('Timed out waiting for ' + name + ' on peer ' + this.id, { cause });
      }
    }
  }
}
export async function setup(t) {
  const service = createGameServer(),
    url = await new Promise((resolve, reject) => {
      service.server.once('error', reject);
      service.server.listen(0, '127.0.0.1', () =>
        resolve('http://127.0.0.1:' + service.server.address().port),
      );
    });
  t.after(async () => {
    for (const s of service.wss.clients) s.terminate();
    await new Promise((resolve) => service.server.close(resolve));
  });
  return {
    ...service,
    url,
    async peer() {
      const p = new Peer(url.replace('http:', 'ws:') + '/ws');
      p.id = (await p.wait('hello')).id;
      return p;
    },
  };
}
