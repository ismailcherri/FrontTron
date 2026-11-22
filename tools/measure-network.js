// Four concurrent real rooms on loopback. Compare the time from a new steering
// press to its visible angle event, including the server clock and WebSocket.
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { setup } from '../test/support/peers.js';

async function measure(withBots) {
  let close;
  const service = await setup({
    after(cb) {
      close = cb;
    },
  });
  const lag = monitorEventLoopDelay({ resolution: 1 });
  try {
    const rooms = await Promise.all(
      Array.from({ length: 4 }, async (_, n) => {
        const name = 'Load ' + n,
          peer = await service.peer();
        await peer.request('room:create', { name });
        await peer.request('room:join', { name });
        await peer.request('player:add', { name: 'Probe' });
        const id = (await peer.wait('room:join')).player.id;
        for (let i = 0; i < 3; i++)
          await peer.request(
            withBots ? 'bot:add' : 'player:add',
            withBots ? { difficulty: 'hard' } : { name: 'Local ' + i },
          );
        const room = service.repository.get(name);
        for (const bonus of Object.keys(room.config.bonuses)) room.config.bonuses[bonus] = false;
        room.controller.launch();
        // Install the fixture before the first physics update in every room.
        room.game.once('game:start', () => {
          room.game.setBorderless(true);
          room.game.avatars.items.forEach((a, i) => {
            a.setPosition(16 + i * 18, 20 + i * 10);
            a.setAngle(0.2 + i * 1.1);
            if (a.id === id) a.setInvincible(true);
          });
        });
        await peer.wait('room:game:start');
        peer.send('ready');
        await peer.wait('game:start');
        return { peer, id, game: room.game };
      }),
    );
    const lat = [];
    lag.enable();
    await Promise.all(
      rooms.map(async ({ peer, id, game }) => {
        for (let i = 0; i < 60; i++) {
          peer.send('player:move', { avatar: id, move: 0 });
          await delay(55);
          peer.log.length = 0;
          const t = performance.now();
          peer.send('player:move', { avatar: id, move: i % 2 ? -1 : 1 });
          try {
            await peer.wait('angle', (d) => d[0] === id);
          } catch (cause) {
            const racer = game.avatars?.getById(id);
            throw new Error('Missing angle at sample ' + i + ', alive=' + racer?.alive + ', round=' + game.inRound, {cause});
          }
          lat.push(performance.now() - t);
        }
      }),
    );
    lag.disable();
    lat.sort((a, b) => a - b);
    console.log(withBots ? '4 humans + 12 Hard bots' : '16 human-controlled slots', {
      samples: lat.length,
      inputMs: [0.95, 0.99].map((q) => +lat[Math.ceil(q * lat.length) - 1].toFixed(2)),
      eventLoopDelayMs: [95, 99].map((q) => +(lag.percentile(q) / 1e6).toFixed(2)),
    });
    for (const { game } of rooms) if (game.room.game) game.abort();
  } finally {
    lag.disable();
    await close();
  }
}
await measure(false);
await measure(true);
