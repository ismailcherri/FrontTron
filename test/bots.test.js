import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TrailField } from '../server/ai/field.js';
import { features, nearest, plan, rollout, observe } from '../server/ai/steering.js';
import { chooseMove } from '../server/ai/drivers.js';
import {
  actionRows,
  featureNames,
  loadWeights,
  policyMove,
  probabilities,
} from '../server/ai/reinforcement.js';
import { pairedMatches, matchSeed } from '../tools/reinforcement-matches.js';
import { botForm } from '../public/views.js';
import { difficulties } from '../public/bots.js';
import Room from '../server/engine/server/model/Room.js';
import Player from '../server/engine/server/model/Player.js';

function scene() {
  return {
    avatar: {
      x: 28,
      y: 40,
      angle: 0,
      radius: 0.6,
      velocity: 16,
      angularVelocityBase: 0.0028,
      directionInLoop: true,
      printing: true,
      bodyCount: 15,
      trailLatency: 3,
    },
    width: 80,
    height: 80,
    field: new TrailField(80),
    wrap: false,
    rivals: [],
    pickups: [],
  };
}
test('predictions preserve real gaps, width, old and new self-trail, invincibility and wrapping', () => {
  const s = scene(),
    a = s.avatar;
  for (let y = 0; y < 80; y += 0.5)
    if (Math.abs(y - 40) > 1.6) s.field.add({ x: 36, y, radius: 0.6, data: null, num: 0 });
  assert.equal(rollout(s, 0, 0).safe, 1);
  a.radius = 2;
  assert.ok(rollout(s, 0, 0).safe < 1);
  a.invincible = true;
  assert.equal(rollout(s, 0, 0).safe, 1);
  a.x = 75;
  assert.ok(rollout(s, 0, 0).safe < 1);
  s.wrap = true;
  assert.equal(rollout(s, 0, 0).safe, 1);
  a.invincible = false;
  s.field.clear();
  s.field.add({ x: 35, y: 40, radius: 0.6, data: a, num: 14 });
  assert.equal(s.field.blocked(35, 40, 0.6, a, 15), false);
  assert.equal(s.field.blocked(35, 40, 0.6, a, 22), true);
  s.field.clear();
  assert.equal(s.field.blocked(35, 40, 0.6, a, 22), false);
});
test('all five policies produce legal steering, with trained held-out imitation metrics', () => {
  const s = scene();
  s.avatar.x = 73;
  s.pickups = [{ x: 79, y: 40 }];
  for (const level of Object.keys(difficulties))
    assert.ok([-1, 1].includes(chooseMove(level, s)), level);
  assert.equal(features(s).length, 18);
  const { metrics } = JSON.parse(readFileSync(new URL('../server/ai/model.json', import.meta.url)));
  assert.ok(metrics.heldOutExamples > 100);
  assert.ok(metrics.agreement > metrics.majorityBaseline);
});
test('bots use both widescreen bounds for steering and wrapped targets', () => {
  const s = scene();
  s.height = 90;
  s.width = 160;
  s.field = new TrailField(s.width);
  s.avatar.x = 105;
  assert.equal(rollout(s, 0, 0).safe, 1);
  for (const level of Object.keys(difficulties)) assert.equal(chooseMove(level, s), 0, level);
  s.avatar.x = 157;
  assert.ok(rollout(s, 0, 0).safe < 1);
  s.wrap = true;
  assert.ok(rollout(s, 0, 0).x < 20);
  assert.deepEqual(nearest(s, 157, 87, [{ x: 2, y: 3 }]), { dx: 5, dy: 6, distance: Math.sqrt(61) });
});
test('the tactical planner takes contested space while the normal planner follows a clear lane', () => {
  const s = scene();
  s.avatar.x = 22;
  s.avatar.y = 21;
  s.rivals = [{ x: 47, y: 34, velocity: 16, angle: Math.PI }];
  assert.ok([-1, 0, 1].includes(plan(s, true)));
  // The two rank the same safe routes differently as the rival changes position.
  let different = false;
  for (const y of [10, 20, 30, 40, 50, 60, 70]) {
    s.rivals[0].y = y;
    if (plan(s) !== plan(s, true)) different = true;
  }
  assert.equal(different, true);
});
test('steering predictions match engine turns and never mutate the live avatar', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const room = new Room('Physics');
  const player = new Player(null, 'Vector', '#77ffbb');
  player.difficulty = 'normal';
  room.addPlayer(player);
  const game = room.newGame(),
    a = game.avatars.getFirst();
  game.drivers.reset();
  for (const rightAngle of [false, true]) {
    a.clear();
    a.setPosition(30, 30);
    a.setAngle(0.1);
    a.directionInLoop = !rightAngle;
    a.angularVelocityBase = rightAngle ? Math.PI / 2 : 0.0028;
    a.setInverse(1);
    const obs = observe(game, a),
      before = a.bodyCount,
      p = rollout(obs, 1, 1, 160);
    assert.equal(a.bodyCount, before);
    assert.equal(a.x, 30);
    a.updateAngularVelocity(-1);
    for (let i = 0; i < 16; i++) a.update(10);
    assert.ok(Math.hypot(p.x - a.x, p.y - a.y) < 0.001);
  }
});

test('Normal lines up an offset gap while the direct path to a pickup is blocked', () => {
  const s = scene(),
    a = s.avatar;
  a.printing = false;
  s.pickups = [{ x: 44, y: 33 }];
  for (let y = 0; y < 80; y += 0.5)
    if (Math.abs(y - 33) > 2.8) s.field.add({ x: 39, y, radius: 0.6 });
  assert.ok(rollout(s, 0, 0).safe < 1);
  for (let i = 0; i < 12; i++) {
    const move = plan(s),
      p = rollout(s, move, move, 140);
    assert.equal(p.safe, 1);
    Object.assign(a, { x: p.x, y: p.y, angle: p.angle });
  }
  assert.ok(a.x > 44);
});

test('drivers handle all pickup types, stacked movement effects, and shield expiry', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: 1000 });
  const room = new Room('Effects');
  for (const difficulty of Object.keys(difficulties)) {
    const p = new Player(null, difficulty, '#66ccff');
    p.difficulty = difficulty;
    room.addPlayer(p);
  }
  const game = room.newGame();
  game.newRound(100000);
  game.world.activate();
  game.bonusManager.world.activate();
  game.avatars.items.forEach((a, i) => {
    a.setPosition(20 + i * 12, 40);
    a.setAngle(0.1);
  });
  const source = game.avatars.getFirst();
  for (const Bonus of Object.values(room.config.bonusTypes)) {
    const item = new Bonus(source.x, source.y);
    game.bonusManager.add(item);
    game.bonusManager.testCatch(source);
    for (const a of game.avatars.items) {
      const obs = observe(game, a);
      assert.ok([-1, 0, 1].includes(chooseMove(a.player.difficulty, obs)));
      assert.ok(features(obs).every(Number.isFinite));
    }
  }
  const obs = scene();
  obs.avatar.invincible = true;
  for (let y = 0; y < 80; y++) obs.field.add({ x: 40, y, radius: 0.8 });
  assert.equal(rollout({ ...obs, shieldMs: 2000 }, 0, 0).safe, 1);
  assert.ok(rollout({ ...obs, shieldMs: 200 }, 0, 0).safe < 1);
  game.abort();
  t.mock.timers.tick(110000);
  assert.equal(room.game, undefined);
});

test('Apex chooses among safe steering inputs using its bundled learned weights', () => {
  const obs = scene();
  const model = JSON.parse(
    readFileSync(new URL('../server/ai/reinforcement-model.json', import.meta.url)),
  );
  const weights = loadWeights(model);
  const rows = actionRows(obs);
  assert.ok(
    rows.every(
      (row) => row.values.length === featureNames.length && row.values.every(Number.isFinite),
    ),
  );
  assert.ok(weights.some((w) => Math.abs(w) > 0.01));
  assert.equal(chooseMove('reinforcement', obs), policyMove(obs, weights));
  const straight = featureNames.map((name) => (name === 'straight' ? 20 : 0));
  assert.equal(policyMove(obs, straight), 0);
  assert.notEqual(
    policyMove(
      obs,
      straight.map((w) => -w),
    ),
    0,
  );
  obs.avatar.x = 73;
  const chances = probabilities(actionRows(obs), straight);
  assert.equal(chances[0], 0);
  assert.ok(Math.abs(chances.reduce((sum, p) => sum + p, 0) - 1) < 1e-12);
  assert.throws(() => loadWeights({ ...model, features: [...model.features].reverse() }));
  assert.throws(() => loadWeights({ ...model, weights: weights.map(() => NaN) }));
  assert.match(botForm({ id: 7, difficulty: 'reinforcement' }), /value="reinforcement" checked/);
});

test('paired Apex evaluations replay both seats and restore the host random generator', () => {
  const random = Math.random;
  assert.notEqual(matchSeed(10000), matchSeed(7000000));
  const scores = pairedMatches(3000000, 2, undefined, 'No bonuses');
  assert.deepEqual(pairedMatches(3000000, 2, undefined, 'No bonuses'), scores);
  assert.equal(Math.random, random);
  for (const opponent of ['hard', 'mimic']) {
    assert.equal(
      Object.values(scores[opponent]).reduce((sum, n) => sum + n, 0),
      4,
    );
  }
});
