import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './support/peers.js';

test('room discovery, private invites, local players, chat, moderation and master transfer', async (t) => {
  const s = await setup(t),
    a = await s.peer(),
    b = await s.peer(),
    c = await s.peer();
  assert.equal((await fetch(s.url + '/healthz')).status, 200);
  const name = (await a.request('room:create', { name: '' })).room.name;
  assert.ok(name.length);
  assert.equal((await b.wait('room:open')).name, name);
  assert.equal((await a.request('room:join', { name })).success, true);
  await a.request('player:add', { name: 'Alpha' });
  const alpha = (await a.wait('room:join')).player;
  assert.equal((await a.wait('room:master')).client, a.id);
  await a.request('player:add', { name: 'Second' });
  const local = (await a.wait('room:join')).player;
  await a.request('room:name', { player: local.id, name: 'Delta' });
  await a.request('room:color', { player: local.id, color: '#ffeedd' });
  const locked = await a.request('room:config:open', { open: false });
  assert.match(locked.password, /^\d{4}$/);
  assert.equal((await b.request('room:join', { name, password: 'bad' })).success, false);
  await a.request('room:talk', 'Hello riders');
  const joined = await b.request('room:join', { name, password: locked.password });
  assert.equal(joined.room.players.find((p) => p.id === local.id).color, '#ffeedd');
  assert.equal(joined.messages.at(-1).content, 'Hello riders');
  await b.request('player:add', { name: 'Beta' });
  await c.request('room:join', { name, password: locked.password });
  await c.request('player:add', { name: 'Gamma' });
  assert.equal((await b.request('room:config:max-score', { maxScore: 1 })).success, false);
  b.send('activity', false);
  assert.equal((await a.wait('client:activity')).active, false);
  b.send('activity', true);
  for (let i = 0; i < 3; i++) assert.equal((await b.request('room:talk', 'msg' + i)).success, true);
  assert.equal((await b.request('room:talk', 'fourth')).success, false);
  a.send('room:launch');
  await b.wait('room:launch:start');
  a.send('room:launch');
  await c.wait('room:launch:cancel');
  await b.request('player:kick', { player: local.id });
  await a.wait('vote:new');
  await c.request('player:kick', { player: local.id });
  assert.equal(await b.wait('room:kick'), local.id);
  const gamma = (await a.wait('room:join', (d) => d.player.name === 'Gamma')).player;
  assert.equal((await a.request('player:kick', { player: gamma.id })).success, true);
  assert.equal(await c.wait('room:kick', (id) => id === gamma.id), gamma.id);
  a.send('room:leave');
  assert.equal((await b.wait('room:master', (d) => d.client === b.id)).client, b.id);
  assert.equal(s.repository.get(name).players.getById(alpha.id), null);
});
test(
  'two remote riders steer, a spectator joins mid-round, scores settle and a rematch starts',
  { timeout: 35000 },
  async (t) => {
    const s = await setup(t),
      a = await s.peer(),
      b = await s.peer(),
      spectator = await s.peer();
    const name = 'Test track';
    await a.request('room:create', { name });
    for (const p of [a, b]) {
      await p.request('room:join', { name });
      await p.request('player:add', { name: 'Rider ' + p.id });
      p.rider = (await p.wait('room:join', (d) => d.player.client === p.id)).player.id;
    }
    await a.request('room:config:max-score', { maxScore: 1 });
    await a.request('room:config:variable', { variable: 'bonusRate', value: 1 });
    await a.request('room:config:bonus', { bonus: 'BonusSelfExplode' });
    await a.request('room:ready', { player: a.rider });
    await b.request('room:ready', { player: b.rider });
    for (const p of [a, b]) {
      await p.wait('room:game:start');
      p.send('ready');
    }
    await a.wait('round:new');
    await a.wait('game:start');
    await b.wait('game:start');
    b.log.length = 0;
    a.send('player:move', { avatar: a.rider, move: 1 });
    await b.wait('angle', (v) => v[0] === a.rider);
    await b.wait('position', (v) => v[0] === a.rider);
    const room = s.repository.get(name),
      game = room.game,
      rider = game.avatars.getById(a.rider);
    // Hold an unobstructed, known path while testing mid-round reconstruction.
    a.log.length = 0;
    rider.updateAngularVelocity(0);
    rider.setPosition(35, 35);
    rider.setAngle(0.3);
    rider.printManager.start();
    await a.wait('position', (v) => v[0] === a.rider && v[1] === 3500);
    await a.wait('property', (v) => v[0] === a.rider && v[1] === 'printing' && v[2]);
    await a.wait('position', (v) => v[0] === a.rider && v[1] > 3500 && v[1] < 3650);
    assert.equal((await spectator.request('room:join', { name })).room.game, true);
    spectator.send('ready');
    const snap = await spectator.wait('spectate');
    assert.equal(snap.spectators, 1);
    assert.equal(snap.phase, 'racing');
    assert.equal(snap.maxScore, 1);
    assert.equal(Object.keys(snap.racers).length, 2);
    assert.ok(snap.trails.length);
    await spectator.request('room:talk', 'Good race');
    await b.wait('room:talk', (d) => d.content === 'Good race');
    game.avatars.getById(b.rider).setPosition(-2, 20);
    const winner = await a.wait('round:end');
    assert.equal(winner, a.rider);
    assert.equal(await spectator.wait('end'), a.rider);
    assert.equal(room.game, undefined);
    assert.ok(room.players.items.every((p) => p.ready === false));
    await a.request('room:ready', { player: a.rider });
    await b.request('room:ready', { player: b.rider });
    await a.wait('room:game:start');
    assert.ok(room.game);
  },
);

test(
  'host-managed bot tiers race, appear to spectators, export only opted-in driving samples, and survive rematches',
  { timeout: 35000 },
  async (t) => {
    const service = await setup(t),
      host = await service.peer(),
      guest = await service.peer(),
      watcher = await service.peer();
    const name = 'Computer circuit';
    await host.request('room:create', { name });
    for (const peer of [host, guest]) {
      await peer.request('room:join', { name });
      await peer.request('player:add', { name: 'Human ' + peer.id });
      peer.rider = (await peer.wait('room:join', (d) => d.player.client === peer.id)).player.id;
    }
    assert.equal((await guest.request('bot:add', { difficulty: 'hard' })).success, false);
    const bots = [];
    for (const level of ['easy', 'reinforcement', 'hard']) {
      bots.push((await host.request('bot:add', { difficulty: level })).player);
      const added = (await guest.wait('room:join', (d) => d.player.difficulty === level)).player;
      if (level === 'reinforcement') assert.equal(added.name, 'Ion');
      assert.equal(added.client, null);
      assert.equal(added.ready, true);
    }
    assert.equal((await host.request('bot:add', { difficulty: 'mimic' })).success, false);
    assert.equal((await guest.request('player:kick', { player: bots[0] })).success, false);
    assert.equal(
      (await guest.request('bot:level', { player: bots[0], difficulty: 'mimic' })).success,
      false,
    );
    assert.equal((await host.request('bot:remove', { player: bots.shift() })).success, true);
    assert.equal((await host.request('bot:add', { difficulty: '__proto__' })).success, false);
    const mimic = (await host.request('bot:add', { difficulty: 'mimic' })).player;
    const apex = bots[0];
    for (const difficulty of ['normal', 'reinforcement']) {
      assert.equal((await host.request('bot:level', { player: apex, difficulty })).success, true);
      assert.equal(
        (await guest.wait('player:difficulty', (p) => p.player === apex)).difficulty,
        difficulty,
      );
    }
    assert.equal((await watcher.wait('room:players', (d) => d.botCount === 3)).players, 5);
    host.send('room:leave');
    await guest.wait('room:master', (d) => d.client === guest.id);
    const room = service.repository.get(name);
    assert.equal(room.players.count(), 4);
    await guest.request('room:config:max-score', { maxScore: 1 });
    await guest.request('driving:record', true);
    await guest.request('room:ready', { player: guest.rider });
    await guest.wait('room:game:start');
    guest.send('ready');
    await guest.wait('game:start');
    await guest.wait('position', (d) => d[0] === mimic);
    await guest.wait('position', (d) => d[0] === apex);
    assert.equal((await guest.wait('driving:sample'))[0].length, 18);
    assert.equal((await guest.request('bot:remove', { player: mimic })).success, false);
    const watching = await watcher.request('room:join', { name });
    watcher.send('ready');
    assert.equal(watching.room.botCount, 3);
    const snap = await watcher.wait('spectate');
    assert.equal(snap.racers[mimic].difficulty, 'mimic');
    assert.equal(snap.racers[mimic].loaded, true);
    assert.equal(snap.racers[apex].difficulty, 'reinforcement');
    assert.equal(snap.racers[apex].loaded, true);
    assert.equal(snap.spectators, 1);
    for (const a of room.game.avatars.items) if (a.id !== apex) a.setPosition(-10, 20);
    await watcher.wait('end', (id) => id === apex);
    assert.equal(
      watcher.log.some(([name]) => name === 'driving:sample'),
      false,
    );
    assert.equal(room.players.getById(mimic).ready, true);
    assert.equal(room.players.getById(apex).difficulty, 'reinforcement');
    assert.equal(room.players.getById(apex).ready, true);
    await guest.request('room:ready', { player: guest.rider });
    await guest.wait('room:game:start');
    guest.send('ready');
    await guest.wait('round:new');
    guest.send('room:leave');
    await watcher.wait('room:leave', (d) => d.player === guest.rider);
    assert.equal(room.game, undefined);
    assert.equal(room.controller.roomMaster, null);
  },
);
