import test from 'node:test';
import assert from 'node:assert/strict';
import Room from '../server/engine/server/model/Room.js';
import Player from '../server/engine/server/model/Player.js';
import { banner, boardScores } from '../public/views.js';

function race(t, count, target) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const room = new Room('Score test');
  for (let i = 0; i < count; i++) {
    const p = new Player({ id: 1, active: true }, 'Rider ' + i, '#ffcc66');
    room.addPlayer(p);
  }
  assert.equal(room.config.getMaxScore(), Math.max(1, (count - 1) * 10));
  if (target) room.config.setMaxScore(target);
  const game = room.newGame();
  for (const rider of game.avatars.items) game.controller.attachAvatar(rider);
  return game;
}

function startRound(game) {
  game.newRound(0);
  game.world.activate();
  game.avatars.items.forEach((r, i) => r.setPosition(10 + i * 8, 30));
}

function crash(game, ...riders) {
  for (const index of riders) game.avatars.items[index].setPosition(-2, 20);
  game.update(0);
}

test('Langtron placements, same-tick draws, cumulative standings and tiebreak rounds', (t) => {
  const game = race(t, 4, 4);
  const riders = game.avatars.items;
  const view = game.controller.view;
  const scores = () => riders.map((r) => r.score);
  startRound(game);
  crash(game, 0);
  crash(game, 1);
  assert.equal(view.racers[riders[1].id].points, 1);
  assert.deepEqual(scores(), [0, 0, 0, 0]);
  crash(game, 2);
  assert.deepEqual(scores(), [0, 1, 2, 3]);
  assert.equal(game.roundWinner, riders[3]);
  assert.deepEqual(
    riders.map((r) => view.racers[r.id].score),
    scores(),
  );

  startRound(game);
  assert.ok(riders.every((r) => view.racers[r.id].points === 0));
  crash(game, 3);
  crash(game, 2);
  crash(game, 1);
  assert.deepEqual(scores(), [3, 3, 3, 3]);
  assert.equal(game.isWon(), null);

  startRound(game);
  crash(game, 1, 3);
  crash(game, 0, 2);
  assert.deepEqual(scores(), [5, 3, 5, 3]);
  assert.equal(game.roundWinner, null);
  assert.equal(game.isWon(), null);
  assert.deepEqual(
    [...boardScores(view, 1).matchAll(/class="rank">(\d+)/g)].map((m) => +m[1]),
    [1, 1, 3, 3],
  );

  startRound(game);
  assert.match(banner(view), /TIE BREAK/);
  crash(game, 0, 1, 2);
  assert.deepEqual(scores(), [5, 3, 5, 6]);
  assert.equal(game.isWon(), riders[3]);
});

test('Langtron solo awards one point on a crash and uses the configured target', (t) => {
  const game = race(t, 1, 2);
  const [rider] = game.avatars.items;
  for (const round of [1, 2]) {
    startRound(game);
    crash(game, 0);
    assert.equal(rider.score, round);
    assert.equal(game.roundWinner, rider);
    assert.equal(game.isWon(), round === 2 ? rider : null);
  }
});
