// Headless, paired rounds in the real game engine. Each seed plays both seat orders.
// Invoke with npm run bots:evaluate -- 20 to change the number of seed pairs.
import { mock } from 'node:test';
import { performance } from 'node:perf_hooks';
import { playRound, roomWith, seedRound } from './headless-round.js';
import { matchSeed } from './reinforcement-matches.js';
import Player from '../server/engine/server/model/Player.js';
import AvatarBody from '../server/engine/server/core/AvatarBody.js';

const count = Number(process.argv[2] || 20);
if (!Number.isSafeInteger(count) || count < 1) throw Error('Expected a positive seed count');
const original = Math.random;
function stats(values) {
  values.sort((a, b) => a - b);
  return [0.95, 0.99].map((q) => Number(values[Math.ceil(q * values.length) - 1].toFixed(3)));
}
// Isolate CPU cost of synchronously ticking four rooms with identical dense boards.
// Revive benchmark riders at their spawn after elimination to keep the workload steady.
function dense(levels, arena) {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 10000 });
  try {
    seedRound(89103);
    const games = Array.from({ length: 4 }, () => roomWith(levels, undefined, arena));
    for (const g of games) {
      g.world.activate();
      const ghost = new Player(null, 'Fixture', '#ffffff').getAvatar();
      for (let i = 0; i < 1500; i++) {
        const body = new AvatarBody(
          Math.random() * g.world.width, Math.random() * g.world.height, ghost,
        );
        g.world.addBody(body);
        g.world.botField?.add(body);
      }
    }
    const times = [];
    for (let tick = 0; tick < 1200; tick++) {
      const start = performance.now();
      for (const g of games) {
        g.inRound = true;
        for (const a of g.avatars.items)
          if (!a.alive) {
            a.clear();
            a.setPosition(
              5 + Math.random() * (g.world.width - 10),
              5 + Math.random() * (g.world.height - 10),
            );
            a.setAngle(Math.random() * 6.28);
          }
        g.update(16);
      }
      if (tick >= 120) times.push(performance.now() - start);
    }
    return stats(times);
  } finally {
    mock.timers.reset();
  }
}
try {
  for (const arena of [
    { arenaView: 'isometric', arenaShape: 'square' },
    { arenaView: 'top-down', arenaShape: 'square' },
    { arenaView: 'top-down', arenaShape: 'widescreen' },
  ]) {
    console.log(arena.arenaView, arena.arenaShape);
    for (const pair of [
      ['easy', 'normal'],
      ['normal', 'hard'],
      ['hard', 'mimic'],
      ['hard', 'reinforcement'],
      ['mimic', 'reinforcement'],
    ]) {
      const tally = { [pair[0]]: 0, [pair[1]]: 0, draw: 0, timeout: 0 };
      for (let i = 0; i < count; i++)
        for (const order of [pair, [...pair].reverse()]) {
          const { winnerSeat, timeout } = playRound(matchSeed(451637 + i), order, arena);
          const result = timeout ? 'timeout' : (order[winnerSeat] ?? 'draw');
          tally[result]++;
        }
      console.log(pair.join(' vs '), tally);
    }
    for (const levels of [
      [null, null, null, null],
      [null, 'normal', 'hard', 'mimic'],
      [null, 'hard', 'hard', 'hard'],
      [null, 'reinforcement', 'reinforcement', 'reinforcement'],
    ]) {
      console.log('4 rooms, dense step p95/p99 ms', levels, dense(levels, arena));
    }
  }
} finally {
  Math.random = original;
}
