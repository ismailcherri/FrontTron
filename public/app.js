import { Connection } from './net.js';
import { trackEvent } from './analytics.js';
import { mountArena } from './arena.js';
import { botLimit, drivingSchema } from './bots.js';
import { mountGuide } from './guide-demos.js';
import { makeMatch, applyMatchEvent } from './match.js';
import { icon, esc } from './icons.js';
import { presets, palette } from './catalog.js';
import { controls, defaults, label } from './controls.js';
import { loadProfile, saveProfile } from './profile.js';
import * as view from './views.js';

const $ = (s) => document.querySelector(s),
  main = $('#main'),
  dialog = $('#dialog'),
  net = new Connection();
const profile = loadProfile();
saveProfile(profile);
const state = {
  rooms: new Map(),
  online: false,
  id: null,
  master: null,
  room: null,
  match: null,
  messages: [],
  muted: new Set(),
  voted: new Set(),
  votes: new Set(),
  filter: 0,
  launching: 0,
  latency: null,
  fps: null,
  kills: [],
  primaryId: null,
};
let stopCanvas = () => {},
  modal = '',
  edit = null,
  toastTimer,
  notifyTimer,
  joining = null,
  routeVersion = 0;
let lastActivity = Date.now(),
  active = true,
  framePending = false;
const playingSounds = new Set();
function sound(name) {
  if (!profile.sound) return;
  const audio = new Audio('/sounds/' + name + '.mp3');
  audio.volume = 0.42;
  playingSounds.add(audio);
  const done = () => playingSounds.delete(audio);
  audio.onended = done;
  audio.onerror = done;
  audio.play().catch(done);
}
function pageView() {
  trackEvent('page_view', state.match ? 'Match' : state.room ? 'Room' : 'Lobby');
}
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}
function notice(text, audio = 'notice', always = false) {
  if (document.hidden || !document.hasFocus() || !active) {
    document.title = text + ' · FrontTron';
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => (document.title = 'FrontTron'), 5000);
    sound(audio);
  } else if (always) sound(audio);
}
function activity() {
  lastActivity = Date.now();
  if (!active) {
    active = true;
    net.signal('activity', true);
  }
}
for (const type of ['focus', 'pointerdown', 'pointermove', 'keydown'])
  window.addEventListener(type, activity, { passive: true });
setInterval(() => {
  if (active && Date.now() - lastActivity > 60000) {
    active = false;
    net.signal('activity', false);
  }
}, 5000);
const localPlayers = () => state.room?.players.filter((p) => p.client === state.id) || [];
const steering = controls(
  localPlayers,
  (avatar, move) => net.signal('player:move', { avatar, move }),
  () => Boolean(!dialog.open && state.match && ['warmup', 'racing'].includes(state.match.phase)),
  activity,
);
function hydrate(p) {
  if (p.client === state.id && !p.keys) {
    const others = localPlayers().filter((q) => q !== p);
    p.keys = others.length ? [...defaults[others.length % defaults.length]] : [...profile.keys];
    if (state.primaryId === null) state.primaryId = p.id;
  }
  return p;
}
function system(content) {
  state.messages.push({ system: true, content, creation: Date.now() });
  updateChat();
}
function updateChat() {
  const feed = $('#feed');
  if (!feed) return;
  const scroll = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 8;
  feed.innerHTML = view.chatLines(state);
  if (scroll) feed.scrollTop = feed.scrollHeight;
}
function header() {
  $('#nav-lobby').innerHTML = icon('grid', 16) + ' Lobby';
  $('#nav-guide').innerHTML = icon('book', 17) + ' Field guide';
  $('#nav-profile').setAttribute('aria-label', 'Pilot profile, ' + profile.name);
  $('#nav-profile').innerHTML = icon('user', 16) + '<span>' + esc(profile.name) + '</span>';
  $('#status').textContent = state.online ? 'Server online' : 'Offline';
  $('#status').className = state.online ? 'online' : '';
}
function updateRooms() {
  if (!$('#rooms')) return;
  const rooms = [...state.rooms.values()].sort(
    (a, b) => Number(a.game) - Number(b.game) || a.name.localeCompare(b.name),
  );
  $('#rooms').innerHTML = view.roomRows(rooms, state.filter, state.online);
  $('#room-count').textContent = String(rooms.length).padStart(2, '0');
  document
    .querySelectorAll('[data-action="filter"]')
    .forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.value === state.filter)));
}
let recording = false;
const examples = [];
function exportExamples() {
  const blob = new Blob([JSON.stringify({ schema: drivingSchema, examples })], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = 'fronttron-driving.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function updateRoom() {
  if (!$('#roster') || !state.room) return;
  $('#roster').innerHTML = view.roster(state);
  $('#rider-count').textContent = state.room.players.length;
  const addBot = $('#add-bot');
  addBot.hidden = state.id !== state.master;
  addBot.disabled = state.room.players.filter((p) => p.difficulty).length >= botLimit;
  $('#record-driving').checked = recording;
  $('[data-action="export-driving"]').disabled = !examples.length;
  const launcher = $('#launch');
  if (state.id === state.master || state.launching) {
    const remaining = Math.max(0, Math.ceil((state.launching - Date.now()) / 1000));
    launcher.innerHTML =
      '<button class="btn ghost" data-action="launch" ' +
      (state.id !== state.master ? 'disabled' : '') +
      '>' +
      icon('flag') +
      (state.launching
        ? 'Starting in ' + remaining + (state.id === state.master ? ' · Cancel' : '')
        : 'Start now') +
      '</button>';
  } else launcher.replaceChildren();
}
function updateHud() {
  const m = state.match;
  if (!m || !$('#arena')) return;
  $('#round-tag').textContent =
    'ROUND ' + String(m.round || 1).padStart(2, '0') + '  /  TARGET ' + m.maxScore;
  $('#scores').innerHTML = view.boardScores(m, state.id);
  const banner = $('#banner'),
    markup = view.banner(m);
  if (banner.innerHTML !== markup) banner.innerHTML = markup;
  const metrics = [
    state.fps === null ? '— FPS' : state.fps + ' FPS',
    state.latency === null ? '— ms' : state.latency + ' ms',
    (localPlayers().length ? '' : 'Spectating · ') + m.spectators + ' watching',
  ];
  $('#metrics').textContent = metrics.join('   /   ');
  $('#kills').innerHTML = state.kills
    .slice(-10)
    .map((k) => '<div>' + esc(k) + '</div>')
    .join('');
  document
    .querySelector('[data-action="audio"]')
    ?.setAttribute('aria-pressed', String(profile.sound));
}
function queueHud() {
  if (!framePending) {
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      updateHud();
    });
  }
}
function render() {
  stopCanvas();
  header();
  main.className = state.match ? 'play-page' : '';
  if (state.match && state.room) {
    main.innerHTML = view.matchShell(state.room);
    stopCanvas = mountArena(
      $('#arena'),
      () => state.match,
      (fps) => {
        state.fps = fps;
        queueHud();
      },
    );
    if (localPlayers().some((p) => p.keys.some((k) => k.startsWith('Touch')))) {
      $('#touch-pads').innerHTML =
        '<button data-touch="TouchLeft">◀ &nbsp; Left</button><button data-touch="TouchRight">Right &nbsp; ▶</button>';
    }
    updateHud();
    updateChat();
  } else if (state.room) {
    main.innerHTML = view.roomShell(state.room);
    updateRoom();
    updateChat();
  } else {
    main.innerHTML = view.home(profile);
    stopCanvas = mountArena($('#preview'));
    updateRooms();
  }
}
let stopGuide;
function openModal(type, title, html) {
  stopGuide?.();
  stopGuide = null;
  dialog.classList.toggle('field-guide', type === 'guide');
  if (!dialog.open) {
    steering.reset();
    dialog.showModal();
  }
  modal = type;
  $('#dialog-body').innerHTML =
    '<div class="dialog-head"><h2 id="dialog-title">' +
    esc(title) +
    '</h2>' +
    (type === 'guide' ? '<button type="button" class="mini" id="guide-playback"></button>' : '') +
    '<button class="mini" data-action="close" aria-label="Close">' +
    icon('close') +
    '</button></div><div class="dialog-content">' +
    html +
    '</div>';
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  if (type === 'guide') {
    stopGuide = mountGuide(dialog);
    dialog.querySelector('[data-action="close"]').focus({ preventScroll: true });
  }
  if (type === 'bot') dialog.querySelector('input:checked')?.focus();
  else dialog.querySelector('input:not([type=checkbox]):not([type=color])')?.focus();
}
function closeModal() {
  if (dialog.open) dialog.close();
  modal = '';
  steering.cancel();
}
dialog.addEventListener('close', () => {
  if (dialog.open) return;
  stopGuide?.();
  stopGuide = null;
  modal = '';
  steering.cancel();
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) closeModal();
});
function playerEditor(rider) {
  const isProfile = !rider,
    source = rider || profile;
  edit = { id: rider?.id ?? null, keys: [...source.keys], isProfile };
  openModal(
    isProfile ? 'profile' : 'rider',
    isProfile ? 'Pilot profile' : 'Edit rider',
    '<form id="pilot-form"><label>Callsign<input name="name" autocomplete="off" maxlength="25" value="' +
      esc(source.name) +
      '" required></label><label>Trail color</label><div class="swatches">' +
      palette
        .map(
          (c) =>
            '<button type="button" style="--swatch:' +
            c +
            '" data-action="swatch" data-color="' +
            c +
            '" aria-label="Select ' +
            c +
            '"></button>',
        )
        .join('') +
      '<input type="color" name="color" aria-label="Custom trail color" value="' +
      esc(source.color) +
      '"></div><label>Steering controls</label><div class="binding">' +
      edit.keys
        .map(
          (k, n) =>
            '<button type="button" data-action="bind" data-index="' +
            n +
            '">' +
            (n ? 'Right' : 'Left') +
            ' <kbd>' +
            esc(label(k)) +
            '</kbd></button>',
        )
        .join('') +
      '</div><p class="help">Select a control and press a key, gamepad button, or move a stick.</p><button class="text-btn" type="button" data-action="touch">Use touch controls</button>' +
      (isProfile
        ? '<div class="checks"><label><input name="sound" type="checkbox" ' +
          (profile.sound ? 'checked' : '') +
          '> Sound effects</label></div>'
        : '') +
      '<div class="form-actions">' +
      (!isProfile
        ? '<button type="button" class="btn ghost" data-action="remove" data-id="' +
          rider.id +
          '">Remove rider</button>'
        : '') +
      '<button class="btn primary">Save changes</button></div></form>',
  );
}
async function request(event, data, fail = 'Action unavailable.') {
  const r = await net.request(event, data);
  if (!r.success) toast(r.error || fail);
  return r;
}
function pathFor(name, pass) {
  return (
    '#/room/' + encodeURIComponent(name) + (pass ? '?password=' + encodeURIComponent(pass) : '')
  );
}
function playingMatch() {
  return (
    state.match && !['finished', 'loading'].includes(state.match.phase) && localPlayers().length
  );
}
function requestLeave() {
  if (!playingMatch()) return leave();
  openModal(
    'leave',
    'Leave the match?',
    '<p>Your riders will leave this match.</p><div class="actions"><button class="btn ghost" data-action="close">Keep playing</button><button class="btn primary" data-action="confirm-leave">Leave match</button></div>',
  );
}
window.addEventListener('beforeunload', (e) => {
  if (playingMatch()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
document.addEventListener('click', (e) => {
  if (playingMatch() && e.target.closest('a[href="#/"]')) {
    e.preventDefault();
    requestLeave();
  }
});
function resetRoom() {
  steering.reset();
  state.room = null;
  state.master = null;
  state.match = null;
  state.primaryId = null;
  state.launching = 0;
  state.messages = [];
  state.kills = [];
  state.muted.clear();
  state.voted.clear();
  state.votes.clear();
  state.latency = null;
  state.fps = null;
}
function leave() {
  ++routeVersion;
  if (state.room || joining) net.signal('room:leave');
  joining = null;
  resetRoom();
  closeModal();
  history.replaceState(null, '', '#/');
  render();
  pageView();
}
async function join(name, password) {
  const token = ++routeVersion;
  if (state.room) {
    net.signal('room:leave');
    resetRoom();
  }
  joining = name;
  const res = await net.request('room:join', { name, password });
  if (token !== routeVersion) return;
  joining = null;
  if (!res.success) {
    if (res.error === 'Wrong password.') return askPassword(name);
    toast(res.error || 'Could not join this room.');
    history.replaceState(null, '', '#/');
    render();
    return;
  }
  closeModal();
  state.room = res.room;
  trackEvent('room_joined', res.room.game ? 'Match' : 'Room');
  state.master = res.master;
  state.launching = res.launching || 0;
  for (const p of state.room.players) hydrate(p);
  state.messages = (res.messages || []).filter(Boolean);
  state.votes = new Set(res.votes.map((v) => v.target));
  const tips = [
    'Green pickups affect you, red affects opponents, and white affects everyone.',
    'Select a rider’s keys to remap a keyboard or gamepad.',
    'Add a local rider to share this device with a friend.',
    'Switch to touch steering in the pilot editor to use the two halves of your screen.',
    'Leave a gap in sight when your own trail starts to close in.',
  ];
  system('Tip · ' + tips[Math.floor(Math.random() * tips.length)]);
  history.replaceState(null, '', pathFor(name, state.room.config.password));
  if (res.room.game) beginMatch();
  else {
    render();
    pageView();
    if (!res.room.players.some((p) => p.name === profile.name)) {
      await request('player:add', { name: profile.name, color: profile.color });
    }
  }
}
function askPassword(name) {
  openModal(
    'password',
    'Private room',
    '<form id="password-form" data-name="' +
      esc(name) +
      '"><p>Enter the four-digit code for ' +
      esc(name) +
      '.</p><label>Room code<input name="password" inputmode="numeric" maxlength="4" required autocomplete="off"></label><button class="btn primary">Join room</button></form>',
  );
}
function route() {
  const hash = location.hash.slice(1),
    m = hash.match(/^\/(?:room|game)\/([^?]+)(?:\?(.*))?$/);
  if (m && state.online) {
    let name;
    try {
      name = decodeURIComponent(m[1]);
    } catch {
      return leave();
    }
    if (state.room?.name !== name && joining !== name)
      join(name, new URLSearchParams(m[2]).get('password'));
  } else if (!m) {
    if (state.room || joining) {
      if (playingMatch()) {
        history.replaceState(null, '', pathFor(state.room.name, state.room.config.password));
        requestLeave();
      } else leave();
    }
    if (hash === '/about') showCredits();
  }
}
function beginMatch() {
  if (!state.room || (state.match && state.match.phase !== 'finished')) return;
  const room = state.room;
  room.isSpectator = !localPlayers().length;
  closeModal();
  state.launching = 0;
  state.kills = [];
  state.latency = null;
  state.match = makeMatch(
    room.players,
    Math.round(Math.sqrt(6400 + (room.players.length - 1) * 1280)),
    room.config.maxScore || Math.max(1, (room.players.length - 1) * 10),
  );
  render();
  net.signal('ready');
  notice('Match starting');
  pageView();
}
function showCredits() {
  openModal(
    'credits',
    'Credits',
    '<p>FrontTron carries forward Langtron, a fork of Curvytron. Thomas Jarrand, Jérémy Fagis, and Johan Dufour created the original game at Elao, inspired by Curve Fever.</p><p>Balancing and development contributions from Emeric Kasbarian and Jérémy James. Thanks to Jeremy, Nicolas, Camille, Maxime, Benjamin, Florian, Guewen, and Xavier.</p><p>Frontend and Web Team 4 Ever</p><a href="/sounds/CREDITS.txt" target="_blank" rel="noopener">Sound credits</a>',
  );
}
net.addEventListener('event', ({ detail: [event, d] }) => {
  if (event === 'match:analytics') {
    trackEvent(d, 'Match');
    return;
  }
  if (event === 'driving:sample') {
    if (recording && examples.length < 10000) {
      examples.push(d);
      if (examples.length === 10000) {
        recording = false;
        net.request('driving:record', false);
        toast('Recording complete. Export the examples in the ready room.');
      }
    }
    return;
  }
  if (event === 'hello') {
    recording = false;
    state.id = d.id;
    state.online = true;
    state.rooms.clear();
    header();
    updateRooms();
    net.signal('room:fetch');
    route();
    return;
  }
  if (event === 'room:open') {
    state.rooms.set(d.name, d);
    updateRooms();
    return;
  }
  if (event === 'room:close') {
    state.rooms.delete(d.name);
    updateRooms();
    return;
  }
  if (['room:players', 'room:game'].includes(event) || (event === 'room:config:open' && d.name)) {
    Object.assign(state.rooms.get(d.name) || {}, d);
    updateRooms();
    return;
  }
  const r = state.room;
  if (!r) return;
  const p = () => r.players.find((p) => p.id === d.player);
  switch (event) {
    case 'room:join':
      if (!pById(d.player.id)) r.players.push(hydrate(d.player));
      updateRoom();
      return;
    case 'room:leave':
      r.players = r.players.filter((p) => p.id !== d.player);
      if (d.player === state.primaryId) state.primaryId = localPlayers()[0]?.id ?? null;
      updateRoom();
      return;
    case 'room:master':
      state.master = d.client;
      if (d.client !== null)
        system(
          (r.players.find((p) => p.client === d.client)?.name || 'A rider') + ' is now the host.',
        );
      updateRoom();
      refreshSettings();
      return;
    case 'client:activity':
      for (const p of r.players) if (p.client === d.client) p.active = d.active;
      updateRoom();
      return;
    case 'room:talk':
      state.messages.push(d);
      updateChat();
      return;
    case 'player:ready':
    case 'player:difficulty':
    case 'player:color':
    case 'player:name':
      if (p()) Object.assign(p(), d);
      updateRoom();
      return;
    case 'room:config:open':
      Object.assign(r.config, d);
      history.replaceState(null, '', pathFor(r.name, d.password));
      refreshSettings();
      return;
    case 'room:config:variable':
      r.config.variables[d.variable] = d.value;
      refreshSettings();
      return;
    case 'room:config:bonus':
      r.config.bonuses[d.bonus] = d.enabled;
      refreshSettings();
      return;
    case 'room:config:max-score':
      r.config.maxScore = d.maxScore;
      refreshSettings();
      return;
    case 'room:launch:start':
      state.launching = Date.now() + 5000;
      notice('Match starts in five seconds');
      updateRoom();
      return;
    case 'room:launch:cancel':
      state.launching = 0;
      updateRoom();
      return;
    case 'room:kick':
      system((pById(d)?.name || 'A rider') + ' was kicked.');
      return;
    case 'vote:new':
      state.votes.add(d.target);
      system('Vote to remove ' + (pById(d.target)?.name || 'a rider') + ' from the room.');
      updateRoom();
      return;
    case 'vote:close':
      state.votes.delete(d.target);
      state.voted.delete(d.target);
      updateRoom();
      return;
    case 'room:game:start':
      beginMatch();
      return;
    case 'spectate':
      state.match = d;
      state.room.isSpectator = true;
      queueHud();
      return;
    case 'latency':
      state.latency = d;
      queueHud();
      return;
  }
  const m = state.match;
  if (!m) return;
  applyMatchEvent(m, event, d);
  if (['position', 'angle', 'point', 'property'].includes(event)) return;
  if (event === 'round:new') {
    state.kills = [];
    steering.reset();
    m.announcedCount = null;
  }
  if (event === 'game:start') notice('Go!', 'notice', true);
  if (event === 'die') {
    const victim = m.racers[d[0]],
      killer = m.racers[d[1]];
    if (victim) {
      victim.diedAt = performance.now();
      state.kills.push(
        victim.name +
          (killer
            ? killer === victim
              ? ' hit their own trail'
              : (d[2] ? ' crashed on ' : ' was cut off by ') + killer.name
            : ' hit the wall'),
      );
      sound('death');
    }
  }
  if (event === 'bonus:pop') sound('bonus-pop');
  if (event === 'bonus:clear') sound('bonus-clear');
  if (event === 'cleanageddon') sound('cleanageddon');
  if (event === 'round:end') {
    steering.reset();
    notice('Round complete');
  }
  if (event === 'end') {
    for (const p of r.players) p.ready = Boolean(p.difficulty);
    notice('Match complete', 'win', true);
  }
  queueHud();
});
function pById(id) {
  return state.room?.players.find((p) => p.id === id);
}
function refreshSettings() {
  if (modal === 'settings' && dialog.open)
    $('#dialog-body .dialog-content').innerHTML = view.settings(state);
}
net.addEventListener('offline', () => {
  state.online = false;
  state.rooms.clear();
  routeVersion++;
  joining = null;
  resetRoom();
  closeModal();
  render();
  toast('Disconnected from the server.');
});
window.addEventListener('hashchange', route);
function updateBindings() {
  document
    .querySelectorAll('[data-action="bind"] kbd')
    .forEach((k, n) => (k.textContent = label(edit.keys[n])));
}
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action,
    id = Number(btn.dataset.id),
    name = btn.dataset.name;
  switch (action) {
    case 'filter':
      state.filter = +btn.dataset.value;
      updateRooms();
      break;
    case 'guide':
      openModal('guide', 'Field guide', view.guide(profile.keys));
      break;
    case 'credits':
      showCredits();
      break;
    case 'profile':
      playerEditor();
      break;
    case 'rider':
      if (pById(id)) playerEditor(pById(id));
      break;
    case 'swatch':
      $('#pilot-form [name=color]').value = btn.dataset.color;
      break;
    case 'bind':
      updateBindings();
      btn.querySelector('kbd').textContent = 'Press now…';
      steering.listen((code) => {
        edit.keys[+btn.dataset.index] = code;
        updateBindings();
      });
      break;
    case 'touch':
      edit.keys = ['TouchLeft', 'TouchRight'];
      steering.cancel();
      updateBindings();
      break;
    case 'close':
      closeModal();
      break;
    case 'create':
      if (!state.online) {
        net.open();
        toast('Connecting to server…');
        break;
      }
      openModal(
        'create',
        'Create room',
        '<form id="create-form"><label>Room name<input name="name" placeholder="Generate a name" maxlength="25" autocomplete="off"></label><p class="help">Leave blank for a random name. You can make the room private in room settings.</p><button class="btn primary">' +
          icon('plus') +
          'Create room</button></form>',
      );
      break;
    case 'join':
      if (state.rooms.get(name)?.open) location.hash = pathFor(name);
      else askPassword(name);
      break;
    case 'invite': {
      const url =
        location.href.split('#')[0] + pathFor(state.room.name, state.room.config.password);
      try {
        await navigator.clipboard.writeText(url);
        trackEvent('invite_copied', 'Room');
        toast('Room link copied.');
      } catch {
        openModal(
          'invite',
          'Invite riders',
          '<label>Room link<input readonly value="' + esc(url) + '"></label>',
        );
      }
      break;
    }
    case 'leave':
      requestLeave();
      break;
    case 'confirm-leave':
      leave();
      break;
    case 'ready':
      await request('room:ready', { player: id });
      break;
    case 'bot': {
      const bot = btn.hasAttribute('data-id') ? pById(id) : null;
      openModal('bot', bot ? 'Edit ' + bot.name : 'Add computer rider', view.botForm(bot));
      break;
    }
    case 'remove-bot':
      if ((await request('bot:remove', { player: id })).success) closeModal();
      break;
    case 'export-driving':
      exportExamples();
      break;
    case 'kick': {
      const res = await request('player:kick', { player: id });
      if (res.success && state.master !== state.id) {
        if (res.kicked) state.voted.add(id);
        else state.voted.delete(id);
        updateRoom();
      }
      break;
    }
    case 'remove':
      if ((await request('player:remove', { player: id })).success) closeModal();
      break;
    case 'settings':
      openModal('settings', 'Room settings', view.settings(state));
      break;
    case 'launch':
      net.signal('room:launch');
      break;
    case 'mute':
      if (state.muted.has(id)) state.muted.delete(id);
      else state.muted.add(id);
      updateChat();
      break;
    case 'back-room':
      if (state.match?.phase === 'finished') {
        state.match = null;
        render();
        pageView();
        if (
          !localPlayers().length &&
          state.room.isSpectator &&
          !state.room.players.some((p) => p.name === profile.name)
        )
          await request('player:add', { name: profile.name, color: profile.color });
      }
      break;
    case 'retry':
      net.open();
      break;
    case 'audio':
      profile.sound = !profile.sound;
      saveProfile(profile);
      if (!profile.sound) for (const audio of playingSounds) audio.pause();
      updateHud();
      break;
  }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target,
    data = new FormData(form);
  if (form.dataset.busy) return;
  form.dataset.busy = 'yes';
  try {
    switch (form.id) {
      case 'create-form': {
        const res = await request(
          'room:create',
          { name: data.get('name').trim() },
          'That room name is already taken.',
        );
        if (res.success) {
          trackEvent('room_created', 'Lobby');
          closeModal();
          location.hash = pathFor(res.room.name);
        }
        break;
      }
      case 'password-form':
        await join(form.dataset.name, data.get('password'));
        break;
      case 'bot-form': {
        const change = form.hasAttribute('data-id');
        const payload = { difficulty: data.get('difficulty') };
        if (change) payload.player = Number(form.dataset.id);
        if ((await request(change ? 'bot:level' : 'bot:add', payload)).success) closeModal();
        break;
      }
      case 'add-player':
        if ((await request('player:add', { name: data.get('name').trim() })).success) form.reset();
        break;
      case 'talk':
        if (
          (
            await request(
              'room:talk',
              data.get('msg').trim(),
              'Wait a moment before sending again.',
            )
          ).success
        )
          form.reset();
        break;
      case 'pilot-form': {
        const name = data.get('name').trim(),
          color = data.get('color');
        if (!name) {
          toast('Enter a callsign.');
          break;
        }
        if (edit.keys[0] === edit.keys[1]) {
          toast('Choose a different control for each direction.');
          break;
        }
        const p = pById(edit.isProfile ? state.primaryId : edit.id);
        if (p && !state.match) {
          if (p.name !== name && !(await request('room:name', { player: p.id, name })).success)
            break;
          if (p.color !== color && !(await request('room:color', { player: p.id, color })).success)
            break;
        }
        if (p) p.keys = [...edit.keys];
        if (edit.isProfile || (p && p.id === state.primaryId)) {
          Object.assign(profile, { name, color, keys: [...edit.keys] });
          if (edit.isProfile) profile.sound = data.has('sound');
          saveProfile(profile);
        }
        closeModal();
        render();
        break;
      }
    }
  } finally {
    delete form.dataset.busy;
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target,
    c = state.room?.config;
  if (el.id === 'record-driving') {
    const enabled = el.checked;
    if (enabled && examples.length >= 10000) {
      el.checked = false;
      toast('Export your examples and refresh to start a new recording.');
      return;
    }
    el.disabled = true;
    if ((await request('driving:record', enabled)).success) recording = enabled;
    el.checked = recording;
    el.disabled = false;
    return;
  }
  if (!c || modal !== 'settings') return;
  if (el.id === 'access') await request('room:config:open', { open: el.value === 'open' });
  if (el.id === 'score-setting')
    await request('room:config:max-score', { maxScore: el.value ? Number(el.value) : null });
  if (el.id === 'rate')
    await request('room:config:variable', { variable: 'bonusRate', value: +el.value });
  if (el.dataset.bonus) await request('room:config:bonus', { bonus: el.dataset.bonus });
  if (el.id === 'preset' && presets[el.value]) {
    const wanted = presets[el.value];
    const changed = Object.keys(c.bonuses).filter((b) => c.bonuses[b] !== wanted.includes(b));
    await Promise.all(changed.map((b) => request('room:config:bonus', { bonus: b })));
  }
});
setInterval(() => {
  if (state.launching && !state.match) updateRoom();
  const match = state.match;
  if (match?.phase === 'warmup') {
    const count = Math.max(1, Math.ceil((match.countdownEnd - Date.now()) / 1000));
    if (count !== match.announcedCount) {
      notice('Round starts in ' + count, 'notice', true);
      match.announcedCount = count;
      queueHud();
    }
  }
}, 200);
render();
pageView();
net.open();
