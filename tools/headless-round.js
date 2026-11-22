import { mock } from 'node:test';
import Room from '../server/engine/server/model/Room.js';
import Player from '../server/engine/server/model/Player.js';
import { presets } from '../public/catalog.js';
export function seedRound(seed) {
  let s = seed;
  Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
export function roomWith(levels, preset) {
  const room = new Room('Evaluation');
  for (const [i, difficulty] of levels.entries()) {
    const p = new Player(
      difficulty ? null : { id: i + 1, active: true },
      'Rider ' + i,
      i % 2 ? '#66ffbb' : '#ffcc66',
    );
    p.difficulty = difficulty;
    room.addPlayer(p);
  }
  if (preset) {
    for (const name of Object.keys(room.config.bonuses))
      room.config.bonuses[name] = presets[preset].includes(name);
  }
  const game = room.newGame();
  game.newRound(0);
  return game;
}

// Run a complete round with the production physics, timers, sensors and input cadence.
// Returning a seat also identifies the winner when both riders are the same policy.
export function playRound(seed, levels, { selectMove, preset } = {}) {
  const original = Math.random;
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 10000 });
  try {
    seedRound(seed);
    const game = roomWith(levels, preset);
    const seats = game.room.players.items;
    if (selectMove)
      game.drivers.selectMove = (level, obs) =>
        selectMove(level, obs, seats.indexOf(obs.avatar.player));
    for (let tick = 0; game.inRound && tick < 3750; tick++) mock.timers.tick(16);
    return {
      winnerSeat: game.inRound ? -1 : seats.indexOf(game.roundWinner?.player),
      timeout: game.inRound,
    };
  } finally {
    mock.timers.reset();
    Math.random = original;
  }
}
