import { EventEmitter } from 'node:events';
import { difficulties } from '../public/bots.js';
import { arenaShapes, arenaViews } from '../public/catalog.js';
import Collection from './engine/shared/Collection.js';

const integer = Number.isSafeInteger;
const player = (data) => integer(data?.player);
const name = (data) => typeof data?.name === 'string';
const hex = (value) => typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value);
const level = (data) =>
  typeof data?.difficulty === 'string' && Object.hasOwn(difficulties, data.difficulty);
const rpc = new Map(
  Object.entries({
    'room:create': name,
    'room:join': name,
    'room:talk': (data) => typeof data === 'string',
    'player:add': (data) => name(data) && (data.color == null || hex(data.color)),
    'player:remove': player,
    'bot:add': level,
    'bot:level': (data) => player(data) && level(data),
    'bot:remove': player,
    'driving:record': (data) => typeof data === 'boolean',
    'player:kick': player,
    'room:ready': player,
    'room:color': (data) => player(data) && hex(data.color),
    'room:name': (data) => player(data) && name(data),
    'room:config:open': (data) => typeof data?.open === 'boolean',
    'room:config:arena-view': (data) =>
      typeof data?.arenaView === 'string' && Object.hasOwn(arenaViews, data.arenaView),
    'room:config:arena-shape': (data) =>
      typeof data?.arenaShape === 'string' && Object.hasOwn(arenaShapes, data.arenaShape),
    'room:config:max-score': (data) =>
      data && (data.maxScore === null || (integer(data.maxScore) && data.maxScore > 0)),
    'room:config:variable': (data) =>
      data?.variable === 'bonusRate' && Number.isFinite(data.value) && Math.abs(data.value) <= 1,
    'room:config:bonus': (data) => /^Bonus[A-Z][A-Za-z]+$/.test(data?.bonus),
  }),
);
const signals = new Map(
  Object.entries({
    'room:fetch': () => true,
    'room:leave': () => true,
    'room:launch': () => true,
    ready: () => true,
    activity: (value) => typeof value === 'boolean',
    'player:move': (data) => integer(data?.avatar) && [-1, 0, 1].includes(data.move),
  }),
);

export class Session extends EventEmitter {
  constructor(id, socket) {
    super();
    this.id = id;
    this.socket = socket;
    this.players = new Collection();
    this.active = true;
    this.room = null;
    this.queue = [];
    this.flushHandle = null;
    this.pingLogger = {
      start: () => {
        if (this.pingTimer) return;
        this.pingTimer = setInterval(() => {
          if (socket.readyState === 1) socket.ping(String(Date.now()));
        }, 1000);
      },
      stop: () => {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      },
    };
    socket.on('pong', (stamp) => {
      const latency = Date.now() - Number(stamp);
      if (Number.isFinite(latency)) this.addEvent('latency', latency);
    });
    socket.on('message', (raw, binary) => {
      if (binary) return socket.close(1003, 'Text messages required');
      let frame;
      try {
        frame = JSON.parse(raw);
      } catch {
        return socket.close(1007, 'Invalid JSON');
      }
      if (!Array.isArray(frame) || frame.length > 64) return socket.close(1008, 'Invalid batch');
      for (const msg of frame) this.receive(msg);
    });
    socket.once('close', () => {
      this.pingLogger.stop();
      clearImmediate(this.flushHandle);
      this.emit('close', this);
      this.removeAllListeners();
    });
    socket.on('error', () => socket.terminate());
    this.on('driving:record', ([enabled, reply]) => {
      this.recordDriving = enabled;
      reply({ success: true });
    });
    this.on('activity', (active) => {
      this.active = active;
    });
    this.addEvent('hello', { id });
  }

  receive(message) {
    if (!Array.isArray(message)) return;
    const [event, data, request] = message;
    if (rpc.has(event) && integer(request)) {
      const reply = (value) => this.addEvent(request, value);
      const locked =
        this.room?.game &&
        (event.startsWith('room:config:') ||
          event.startsWith('bot:') ||
          (event === 'driving:record' && data) ||
          ['room:ready', 'player:remove', 'player:kick', 'room:name', 'room:color'].includes(
            event,
          ));
      if (
        !rpc.get(event)(data) ||
        !this.listenerCount(event) ||
        locked ||
        (event === 'room:join' && this.room)
      ) {
        return reply({ success: false, error: 'This action is unavailable.' });
      }
      this.emit(event, [data, reply]);
    } else if (signals.get(event)?.(data)) {
      if (event === 'ready') {
        if (this.loadedGame === this.room?.game) return;
        this.loadedGame = this.room?.game;
      }
      this.emit(event, data);
    }
  }

  serialize() {
    return { id: this.id, active: this.active };
  }
  isPlaying() {
    return !this.players.isEmpty();
  }
  clearPlayers() {
    this.emit('players:clear', this);
    this.players.clear();
    this.loadedGame = null;
  }
  addEvent(name, data) {
    this.addEvents([[name, data]]);
  }
  addEvents(events) {
    if (this.socket.readyState !== 1 || !events.length) return;
    this.queue.push(...events);
    if (this.flushHandle) return;
    this.flushHandle = setImmediate(() => {
      this.flushHandle = null;
      if (this.socket.readyState === 1) this.socket.send(JSON.stringify(this.queue));
      this.queue = [];
    });
  }
}
