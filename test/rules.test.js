import test from 'node:test';
import assert from 'node:assert/strict';
import Room from '../server/engine/server/model/Room.js';
import Player from '../server/engine/server/model/Player.js';
import AvatarBody from '../server/engine/server/core/AvatarBody.js';
import { bonuses, presets } from '../public/catalog.js';
import { makeMatch, applyMatchEvent, cameraRiders, platformViews } from '../public/match.js';
import { settings } from '../public/views.js';
import { TrailField } from '../server/ai/field.js';
import { observe } from '../server/ai/steering.js';

function fixture(t, names = ['Amber', 'Teal'], arenaView = 'isometric', levels = 1) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const room = new Room('Test circuit');
  room.config.arenaView = arenaView;
  room.config.isometricLevels = levels;
  for (const [index, name] of names.entries()) {
    room.addPlayer(
      new Player({ id: index + 1, active: true }, name, ['#ffbb11', '#44eeee', '#fa72b7'][index]),
    );
  }
  const game = room.newGame(),
    [self, enemy] = game.avatars.items;
  game.world.activate();
  self.setPosition(25, 25);
  enemy.setPosition(60, 60);
  return { room, game, self, enemy };
}

function collect({ room, game, self }, name, rider = self) {
  const pickup = new room.config.bonusTypes[name](rider.x, rider.y);
  game.bonusManager.world.activate();
  game.bonusManager.add(pickup);
  game.bonusManager.testCatch(rider);
  return pickup;
}
const outcomes = {
  BonusSelfFast: ({ self }) => assert.equal(self.velocity, 28),
  BonusEnemyFast: ({ self, enemy }) => assert.deepEqual([self.velocity, enemy.velocity], [16, 28]),
  BonusSelfSlow: ({ self }) => assert.equal(self.velocity, 8),
  BonusEnemySlow: ({ enemy }) => assert.equal(enemy.velocity, 8),
  BonusGameBorderless: ({ game }) => assert.equal(game.borderless, true),
  BonusSelfMaster: ({ self }) => assert.ok(self.invincible && !self.printing),
  BonusEnemyBig: ({ enemy }) => assert.equal(enemy.radius, 1.2),
  BonusAllColor: ({ self, enemy }) =>
    assert.deepEqual([self.color, enemy.color], [enemy.player.color, self.player.color]),
  BonusEnemyInverse: ({ enemy }) => {
    enemy.updateAngularVelocity(1);
    assert.ok(enemy.angularVelocity < 0);
  },
  BonusSelfSmall: ({ self, enemy }) => assert.deepEqual([self.body.radius, enemy.body.radius], [0.3, 0.6]),
  BonusGameClear: ({ game }) => {
    assert.equal(game.world.bodyCount, 0);
    assert.equal(game.bonusManager.isCleanageddon, true);
    assert.equal(game.bonusManager.bonusCap, 50);
  },
  BonusEnemyStraightAngle: ({ enemy }) => {
    enemy.updateAngularVelocity(1);
    enemy.updateAngle(16);
    assert.equal(enemy.angle, Math.PI / 2);
  },
  BonusSelfInvincible: ({ self }) => assert.ok(self.invincible && self.velocity === 12),
  BonusGameProbability: ({ game }) => assert.equal(game.bonusManager.bonusPopingTime, 100),
  BonusAllColorBlack: ({ self, enemy }) =>
    assert.deepEqual([self.color, enemy.color], ['#000000', '#000000']),
  BonusAllDashed: ({ self, enemy }) =>
    assert.deepEqual([self.printManager.holeDistance, enemy.printManager.holeDistance], [15, 15]),
  BonusSelfExplode: ({ self }) => assert.equal(self.radius, 4.8),
  BonusSelfYscaler: ({ self }) => assert.equal(self.velocity, 1.6),
};
test('the lobby exposes every selectable server bonus and all five presets', (t) => {
  const { room } = fixture(t);
  assert.deepEqual(
    Object.keys(bonuses).sort(),
    room.config
      .getBonuses()
      .map((b) => b.name)
      .sort(),
  );
  assert.deepEqual(Object.keys(presets), [
    'All',
    'Solo',
    'Speed of light',
    'Super size me',
    'No bonuses',
  ]);
});
for (const [name, verify] of Object.entries(outcomes)) {
  test(name + ' reaches its original targets through pickup collision', (t) => {
    const ctx = fixture(t),
      { room, game, self } = ctx;
    game.world.addBody(new AvatarBody(10, 10, self));
    game.bonusManager.world.activate();
    const pickup = new room.config.bonusTypes[name](self.x, self.y);
    game.bonusManager.add(pickup);
    game.bonusManager.testCatch(self);
    assert.equal(game.bonusManager.bonuses.count(), 0);
    verify(ctx);
    // Let the real expiry callback restore temporary effects.
    if (pickup.duration) {
      t.mock.timers.tick(pickup.duration);
      for (const r of game.avatars.items) {
        assert.equal(r.radius, 0.6);
        assert.equal(r.velocity, 16);
        assert.equal(r.inverse, false);
        assert.equal(r.invincible, false);
        assert.equal(r.color, r.player.color);
      }
      assert.equal(game.borderless, false);
    }
  });
}

for (const { name, value, levels } of [
  { name: 'BonusEnemyBig', value: ({ enemy }) => enemy.body.radius, levels: [0.6, 1.2, 2.4, 4.8] },
  { name: 'BonusSelfSmall', value: ({ self }) => self.radius, levels: [0.6, 0.3, 0.15, 0.075] },
  { name: 'BonusSelfFast', value: ({ self }) => self.velocity, levels: [16, 28, 40, 52] },
  { name: 'BonusEnemySlow', value: ({ enemy }) => enemy.velocity, levels: [16, 8, 1.6, 1.6] },
  { name: 'BonusAllDashed', value: ({ self }) => self.printManager.holeDistance, levels: [5, 15, 25, 35] },
]) {
  test(name + ' stacks to its limit and steps back down as pickups expire', (t) => {
    const ctx = fixture(t);
    const { room, game, self } = ctx;
    const Pickup = room.config.bonusTypes[name];
    game.bonusManager.world.activate();

    for (const expected of [...levels.slice(1), levels.at(-1)]) {
      game.bonusManager.add(new Pickup(self.x, self.y));
      game.bonusManager.testCatch(self);
      assert.equal(value(ctx), expected);
      t.mock.timers.tick(100);
    }

    t.mock.timers.tick(Pickup.prototype.duration - 400);
    for (const expected of levels.toReversed()) {
      assert.equal(value(ctx), expected);
      t.mock.timers.tick(100);
    }
  });
}

test('opposing pickups combine before the size limit is applied', (t) => {
  const ctx = fixture(t);
  const { enemy } = ctx;

  for (let i = 0; i < 4; i++) collect(ctx, 'BonusEnemyBig');
  collect(ctx, 'BonusSelfSmall', enemy);
  assert.equal(enemy.radius, 4.8);
  collect(ctx, 'BonusSelfSmall', enemy);
  assert.equal(enemy.radius, 2.4);
});

for (const name of Object.keys(bonuses)) {
  test(name + ' bounds repeated pickups per target and expires after the last collection', (t) => {
    const ctx = fixture(t);
    const { game, self, enemy } = ctx;
    for (const rider of [self, enemy]) {
      game.controller.attachAvatar(rider);
      rider.printManager.start();
    }
    const pickup = collect(ctx, name);
    const { affect, duration, maxStacks } = pickup;
    assert.ok(Number.isInteger(maxStacks) && maxStacks > 0 && maxStacks <= 6);
    const targets = { self: [self], enemy: [enemy], all: [self, enemy], game: [game] }[affect];
    function checkCount(count) {
      for (const target of [self, enemy, game]) {
        const expected = targets.includes(target) ? count : 0;
        assert.equal(target.bonusStack.bonuses.count(), expected);
        if (target !== game)
          assert.equal(Object.keys(game.controller.view.racers[target.id].effects).length, expected);
      }
    }

    for (let i = 0; i < 12; i++) collect(ctx, name);
    checkCount(maxStacks);
    t.mock.timers.tick(duration / 2);
    collect(ctx, name);
    t.mock.timers.tick(duration / 2);
    checkCount(1);
    outcomes[name](ctx);

    t.mock.timers.tick(duration / 2);
    checkCount(0);
    for (const rider of [self, enemy]) {
      assert.equal(rider.radius, 0.6);
      assert.equal(rider.velocity, 16);
      assert.equal(rider.inverse, false);
      assert.equal(rider.directionInLoop, true);
      assert.equal(rider.invincible, false);
      assert.equal(rider.color, rider.player.color);
      assert.equal(rider.printManager.active, true);
      assert.equal(rider.printManager.holeDistance, 5);
    }
    assert.equal(game.borderless, false);
    assert.equal(game.controller.view.cleanageddon, false);
    assert.equal(game.bonusManager.bonusCap, 20);
    assert.equal(game.bonusManager.bonusPopingTime, game.bonusManager.originalBonusPopingTime);
  });
}

test('overlapping spawn effects expire independently and old timers cannot change a new round', (t) => {
  const ctx = fixture(t);
  const { game } = ctx;
  const manager = game.bonusManager;
  collect(ctx, 'BonusGameClear');
  t.mock.timers.tick(3000);
  collect(ctx, 'BonusGameProbability');
  assert.equal(manager.bonusCap, 50);
  assert.equal(game.controller.view.cleanageddon, true);
  t.mock.timers.tick(2000);
  assert.equal(game.controller.view.cleanageddon, false);
  assert.equal(manager.bonusCap, 10);
  assert.equal(manager.bonusPopingTime, 100);

  game.newRound(10000);
  assert.equal(manager.bonusCap, 20);
  collect(ctx, 'BonusGameProbability');
  t.mock.timers.tick(3000);
  assert.equal(manager.bonusCap, 10);
  t.mock.timers.tick(2000);
  assert.equal(manager.bonusPopingTime, manager.originalBonusPopingTime);
  game.abort();
});

test('right angles expiring during a boost restore the current turning speed', (t) => {
  const ctx = fixture(t);
  const { enemy } = ctx;
  collect(ctx, 'BonusEnemyFast');
  enemy.updateAngularVelocity(1);
  const boostedTurn = enemy.angularVelocity;
  collect(ctx, 'BonusEnemyStraightAngle');
  assert.equal(enemy.angularVelocity, Math.PI / 2);
  t.mock.timers.tick(5000);
  assert.equal(enemy.angularVelocity, boostedTurn);
  t.mock.timers.tick(1000);
  assert.equal(enemy.angularVelocity, 2.8 / 1000);
});

test('an enemy pickup refreshes only the rivals affected by the new collection', (t) => {
  const ctx = fixture(t, ['Amber', 'Teal', 'Pink']);
  const { self, enemy, game } = ctx;
  const third = game.avatars.items[2];
  collect(ctx, 'BonusEnemyInverse', self);
  t.mock.timers.tick(3000);
  collect(ctx, 'BonusEnemyInverse', enemy);
  assert.ok(self.inverse && enemy.inverse && third.inverse);
  t.mock.timers.tick(2000);
  assert.ok(self.inverse && !enemy.inverse && third.inverse);
  t.mock.timers.tick(3000);
  assert.ok(!self.inverse && !enemy.inverse && !third.inverse);
});

test('a spawn rush reschedules the pending spawn when it starts and ends', (t) => {
  const ctx = fixture(t);
  const manager = ctx.game.bonusManager;
  t.mock.method(manager, 'getRandomPopingTime', () => manager.bonusPopingTime);
  const spawn = t.mock.method(manager, 'getRandomBonusType', () => null);
  manager.start();
  collect(ctx, 'BonusGameProbability');
  t.mock.timers.tick(100);
  assert.equal(spawn.mock.callCount(), 1);
  t.mock.timers.tick(4900);
  const afterRush = spawn.mock.callCount();
  t.mock.timers.tick(manager.originalBonusPopingTime - 1);
  assert.equal(spawn.mock.callCount(), afterRush);
  t.mock.timers.tick(1);
  assert.equal(spawn.mock.callCount(), afterRush + 1);
  manager.stop();
});

test('a pickup still triggers at the original three-unit radius plus the rider radius', (t) => {
  const { room, game, self } = fixture(t);
  const pickup = new room.config.bonusTypes.BonusSelfFast(30, 30);
  game.bonusManager.world.activate();
  game.bonusManager.add(pickup);
  self.setPosition(33.61, 30);
  game.bonusManager.testCatch(self);
  assert.equal(self.velocity, 16);
  self.setPosition(33.59, 30);
  game.bonusManager.testCatch(self);
  assert.equal(self.velocity, 28);
});
test('a tie at the target needs another round and a clear leader wins', (t) => {
  const { game, self, enemy } = fixture(t);
  self.score = enemy.score = game.maxScore;
  assert.equal(game.isWon(), null);
  self.score++;
  assert.equal(game.isWon(), self);
});
test('wall, own trail, opponent trail, and open-border travel', (t) => {
  const { game, self, enemy } = fixture(t);
  self.setAngle(0.1);
  const trail = new AvatarBody(40, 40, self);
  game.world.addBody(trail);
  self.setPosition(40, 40);
  self.body.num = trail.num + 1;
  assert.equal(game.world.getBody(self.body), null);
  self.body.num = trail.num + 5;
  assert.equal(game.world.getBody(self.body), trail);
  enemy.setPosition(40, 40);
  assert.equal(game.world.getBody(enemy.body), trail);
  enemy.setPosition(60, 60);
  self.setPosition(-1, 30);
  game.setBorderless(true);
  game.update(0);
  assert.equal(self.x, game.size);
  assert.equal(self.alive, true);
  game.setBorderless(false);
  game.update(0);
  assert.equal(self.alive, false);
});
test('the shape selector is top-down only and isometric matches use square bounds', (t) => {
  const { room, game } = fixture(t);
  const form = () => settings({ room: room.serialize(), master: 1, id: 1 });
  assert.doesNotMatch(form(), /id="arena-shape"/);
  assert.equal(game.world.width, game.world.height);
  assert.equal(game.bonusManager.world.width, game.world.width);
  assert.equal(game.controller.view.arenaShape, 'square');

  const match = makeMatch([], 90, 1, 'isometric', 'widescreen');
  assert.equal(match.arenaShape, 'square');
  applyMatchEvent(match, 'round:new', { size: 80, arenaShape: 'widescreen', warmup: 3000 });
  assert.equal(match.width, match.height);
  assert.equal(match.arenaShape, 'square');

  room.config.arenaView = 'top-down';
  assert.match(form(), /id="arena-shape".*value="widescreen" selected/);
});

test('only multi-level isometric rooms open lifts, and both ends must be clear', t => {
  for (const [arenaView, requested, count] of [
    ['isometric', 1, 1], ['isometric', 2, 2], ['isometric', 3, 3],
    ['top-down', 3, 1], ['first-person', 3, 1],
  ]) {
    const room = new Room('Lift layout');
    Object.assign(room.config, {arenaView, isometricLevels: requested});
    const form = settings({room: room.serialize(), master: 1, id: 1});
    assert.equal(form.includes('id="arena-levels"'), arenaView === 'isometric');
    room.addPlayer(new Player(null, 'Pilot', '#ff5555'));
    const game = room.newGame();
    t.after(() => clearTimeout(game.controller.waiting));
    assert.equal(game.controller.view.levelCount, count);
    if (count === 1) {
      assert.equal(game.platforms, null);
      continue;
    }
    game.world.activate();
    const obstacle = new AvatarBody(15, 15, game.avatars.getFirst());
    obstacle.level = 1;
    game.world.addBody(obstacle);
    const samples = [[15, 15], [25, 25], [45, 45], [55, 55], [65, 65]];
    t.mock.method(game.world, 'randomizePosition', body => {
      [body.x, body.y] = samples.shift();
    });
    game.platforms.reset();
    const links = game.controller.view.links;
    assert.deepEqual(links.map(p => p.x), count === 3 ? [25, 45] : [25]);
    game.platforms.tick(16001);
    assert.equal(game.controller.view.links.length, count - 1);
    assert.notDeepEqual(game.controller.view.links, links);
  }
});

test('a rider can climb and descend, with isolated trails, pickups and bot observations', t => {
  const {room, game, self, enemy} = fixture(t, ['A', 'B'], 'isometric', 3);
  const {view} = game.controller;
  game.controller.attachAvatar(self);
  game.world.botField = new TrailField(game.world.width);
  game.started = game.inRound = true;
  game.platforms.remaining = 16000;
  game.platforms.links = [{lower: 0, x: 30, y: 25, radius: 3.5}, {lower: 1, x: 45, y: 25, radius: 3.5}];
  self.setPosition(25, 25);
  self.updateVelocities();
  const blockedExit = new AvatarBody(26.6, 25, enemy);
  blockedExit.level = 1;
  game.world.addBody(blockedExit);
  game.update(100);
  assert.equal(self.body.level, 0);
  assert.ok(self.alive);
  game.world.removeBody(blockedExit);
  self.setPosition(25, 25);
  self.setPrinting(true);
  game.update(100);
  assert.equal(self.body.level, 1);
  game.update(100);
  assert.equal(self.body.level, 1);
  assert.deepEqual(view.trails.map(trail => trail.level), [0, 1]);
  assert.deepEqual(view.trails[0].points.slice(-2), view.trails[1].points.slice(0, 2));
  assert.equal(self.velocity, 16);
  assert.equal(self.angle, 0);

  const lowerTrail = new AvatarBody(38, 25, enemy);
  game.world.addBody(lowerTrail);
  game.world.botField.add(lowerTrail);
  self.setPosition(38, 25);
  assert.equal(game.world.getBody(self.body), null);
  const obs = observe(game, self);
  assert.equal(obs.field.blocked(38, 25, self.radius, self, self.bodyCount), false);
  assert.deepEqual(obs.rivals, []);
  const pickup = new room.config.bonusTypes.BonusSelfFast(38, 25);
  game.bonusManager.world.activate();
  game.bonusManager.add(pickup, 2);
  game.bonusManager.testCatch(self);
  assert.equal(self.velocity, 16);
  assert.equal(view.pickups[pickup.id].level, 2);
  assert.deepEqual(observe(game, self).pickups, []);

  self.setPrinting(false);
  game.update(250);
  assert.equal(self.body.level, 2);
  self.setPosition(38, 25);
  game.bonusManager.testCatch(self);
  assert.equal(self.velocity, 28);
  assert.equal(view.pickups[pickup.id], undefined);
  self.setPosition(49, 26.5);
  self.setAngle(Math.PI);
  game.update(100);
  assert.equal(self.body.level, 1);
  self.setPosition(35, 27);
  game.update(100);
  assert.equal(self.body.level, 0);
  self.setPosition(38, 25);
  assert.equal(game.world.getBody(self.body), lowerTrail);

  game.onRoundNew();
  assert.equal(view.racers[self.id].level, 0);
  assert.equal(self.body.level, 0);
  assert.deepEqual(view.trails, []);
  assert.equal(view.links.length, 2);
});

test('stacked platform cameras share a floor, split upon transfer and follow survivors', () => {
  const match = makeMatch([
    { id: 1, client: 90 }, { id: 2, client: 12 }, { id: 3, client: 12 },
  ], 80, 10, 'isometric', 'square', 3);
  const views = (client) => platformViews(Object.values(match.racers), client)
    .map(({level, riders}) => [level, riders.map(r => r.id)]);
  const transfer = (id, level) => applyMatchEvent(match, 'property', [id, 'level', level]);
  assert.deepEqual(views(12), [[0, []]]);
  for (const id of [1, 2, 3]) applyMatchEvent(match, 'position', [id, 2500, 2500]);
  transfer(1, 2);
  assert.deepEqual(views(12), [[0, [2, 3]]]);
  assert.deepEqual(views(99), [[2, [1]]]);
  transfer(2, 1);
  assert.deepEqual(views(12), [[1, [2]], [0, [3]]]);
  transfer(3, 1);
  assert.deepEqual(views(12), [[1, [2, 3]]]);
  applyMatchEvent(match, 'die', [2]);
  assert.deepEqual(views(12), [[1, [3]]]);
  applyMatchEvent(match, 'game:leave', 3);
  assert.deepEqual(views(12), [[2, [1]]]);
  applyMatchEvent(match, 'round:new', {size: 80, warmup: 3000});
  assert.deepEqual(views(12), [[0, []]]);
});

test('first-person cameras track local riders and switch to a survivor after elimination', () => {
  const match = makeMatch([
    { id: 1, client: null, difficulty: 'hard' },
    { id: 2, client: 8 }, { id: 3, client: 8 }, { id: 4, client: 9 },
  ], 80, 1, 'first-person');
  const cameras = (client) => cameraRiders(Object.values(match.racers), client).map((r) => r.id);
  assert.deepEqual(cameras(8), []);
  for (const id of [1, 2, 3, 4]) applyMatchEvent(match, 'position', [id, 1000, 2000]);
  assert.deepEqual(cameras(8), [2, 3]);
  assert.deepEqual(cameras(9), [4]);
  assert.deepEqual(cameras(10), [1]);
  applyMatchEvent(match, 'die', [2]);
  assert.deepEqual(cameras(8), [3]);
  applyMatchEvent(match, 'die', [3]);
  assert.deepEqual(cameras(8), [1]);
  applyMatchEvent(match, 'game:leave', 1);
  assert.deepEqual(cameras(8), [4]);
  applyMatchEvent(match, 'die', [4]);
  assert.deepEqual(cameras(8), [2]);
  applyMatchEvent(match, 'round:new', { size: 80, warmup: 3000 });
  assert.deepEqual(cameras(8), []);
  applyMatchEvent(match, 'position', [2, 3000, 4000]);
  assert.deepEqual(cameras(8), [2]);
});

test('widescreen extends spawns, pickups, trail collisions and wall wrapping into the extra track', (t) => {
  const ctx = fixture(t, ['Amber', 'Teal'], 'top-down');
  const { game, self, enemy } = ctx;
  const { width, height } = game.world;
  assert.equal(height, game.size);
  assert.equal(width, height * 16 / 9);
  const random = t.mock.method(Math, 'random', () => 0.93);
  for (const source of [game.world, game.bonusManager]) {
    const [x, y] = source.getRandomPosition(3, 0.05);
    assert.ok(x > height && x < width && y > 0 && y < height);
  }
  random.mock.restore();

  self.setPosition(width - 5, height / 2);
  game.update(0);
  assert.equal(self.alive, true);
  collect(ctx, 'BonusSelfFast');
  assert.equal(self.velocity, 28);
  const trail = new AvatarBody(self.x, self.y, enemy);
  game.world.addBody(trail);
  assert.equal(game.world.getBody(self.body), trail);

  game.setBorderless(true);
  for (const [x, y, targetX, targetY] of [
    [-1, 30, width, 30], [width + 1, 30, 0, 30],
    [width - 3, -1, width - 3, height], [width - 3, height + 1, width - 3, 0],
  ]) {
    self.setPosition(x, y);
    game.update(0);
    assert.deepEqual([self.x, self.y, self.alive], [targetX, targetY, true]);
  }
  game.setBorderless(false);
  self.setPosition(width - self.radius / 2, 30);
  game.update(0);
  assert.equal(self.alive, false);

  enemy.present = false;
  game.setSize();
  assert.ok(game.world.width < width);
  assert.equal(game.world.width, game.world.height * 16 / 9);
  assert.equal(game.bonusManager.world.width, game.world.width);
});

test('snapshot trails split on holes, color, width, wraps, and clears', () => {
  const m = makeMatch([{ id: 1, name: 'A', color: '#efae21' }], 80, 1);
  const event = (n, d) => applyMatchEvent(m, n, d);
  event('position', [1, 100, 200]);
  event('property', [1, 'printing', true]);
  event('position', [1, 200, 200]);
  event('property', [1, 'printing', false]);
  event('position', [1, 400, 200]);
  event('property', [1, 'printing', true]);
  event('position', [1, 500, 200]);
  event('property', [1, 'color', '#ffffff']);
  event('property', [1, 'radius', 1.2]);
  event('position', [1, 600, 200]);
  event('position', [1, 7900, 200]);
  event('position', [1, 7800, 200]);
  assert.deepEqual(
    m.trails.map((t) => t.points),
    [
      [1, 2, 2, 2],
      [4, 2, 5, 2],
      [5, 2, 6, 2],
      [79, 2, 78, 2],
    ],
  );
  assert.equal(m.trails[2].color, '#ffffff');
  assert.equal(m.trails[2].radius, 1.2);
  event('clear');
  assert.equal(m.trails.length, 0);
});
