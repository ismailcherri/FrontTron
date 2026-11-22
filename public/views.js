import { icon as i, esc as e } from './icons.js';
import { difficulties } from './bots.js';
import { bonuses, presets } from './catalog.js';
import { label } from './controls.js';

const keycaps = (keys) => keys.map((k) => '<kbd>' + e(label(k)) + '</kbd>').join('');
const button = (action, text, symbol, cls = 'btn') =>
  '<button class="' +
  cls +
  '" data-action="' +
  action +
  '">' +
  (symbol ? i(symbol) : '') +
  text +
  '</button>';
const count = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
export function helmet(color) {
  return (
    '<div class="helmet" style="--pilot:' +
    e(color) +
    '"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="m11 34 5-12 11-8 16 2 9 10 2 13-9 10-18 1-12-9z" fill="currentColor"/><path d="m15 32 13-7 23 1-1 8-8 5-9-5-16 2z" fill="#172026"/><path d="m36 28 13-1-1 4-10 2z" fill="#d2eee5"/><path d="m17 38 10-2 7 6 12-2-3 6-16 1z" fill="#151c24"/><path d="m19 24 9-7 9 1-10 4z" fill="#fff" opacity=".65"/></svg></div>'
  );
}
export function home(profile) {
  return (
    '<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="slashes">///</span> MULTIPLAYER CURVE SURVIVAL</div><h1>LAST TRAIL<br><em>STANDING.</em></h1><p>Steer your light cycle, cut through gaps, and outlast the other riders.</p><div class="actions">' +
    button('create', 'Create room', 'plus', 'btn primary') +
    button('guide', 'How to play', 'book', 'btn ghost') +
    '</div></div><div class="hero-visual"><canvas id="preview" aria-label="Animated isometric arena with three light cycles"></canvas><span class="preview-caption"><span></span> ARENA PREVIEW</span></div></section>' +
    '<div class="lobby-cols"><section class="browser panel"><div class="panel-heading"><div class="section-icon">' +
    i('layers', 21) +
    '</div><h2>Room browser</h2><span id="room-count" class="tag"></span></div><div class="filter-bar"><div class="filters">' +
    ['All rooms', 'Joinable', 'In game']
      .map((s, n) => '<button data-action="filter" data-value="' + n + '">' + s + '</button>')
      .join('') +
    '</div><span class="live"><b></b> Live</span></div><div id="rooms"></div></section>' +
    '<aside class="pilot panel"><div class="panel-heading"><div class="section-icon">' +
    i('user', 20) +
    '</div><h2>Your pilot</h2>' +
    button('profile', '<span class="sr">Edit profile</span>', 'edit', 'mini push') +
    '</div><div class="pilot-body"><div class="identity">' +
    helmet(profile.color) +
    '<div><small>CALLSIGN</small><h3>' +
    e(profile.name) +
    '</h3><div class="color-id"><b style="background:' +
    e(profile.color) +
    '"></b>' +
    e(profile.color.toUpperCase()) +
    '</div></div></div><div class="pilot-controls"><span>' +
    i('key') +
    ' Steering</span><div>' +
    keycaps(profile.keys) +
    '</div></div></div></aside></div>'
  );
}
export function roomRows(rooms, filter, online) {
  const list = rooms.filter((r) => filter === 0 || (filter === 1 ? !r.game : r.game));
  if (!online)
    return (
      '<div class="empty">' +
      i('pulse', 31) +
      '<h3>Server disconnected</h3>' +
      button('retry', 'Reconnect', null, 'text-btn') +
      '</div>'
    );
  if (!list.length)
    return (
      '<div class="empty"><div class="empty-icon">' +
      i('layers', 28) +
      '</div><div><h3>' +
      (!rooms.length
        ? 'No active rooms'
        : filter === 1
          ? 'No joinable rooms'
          : 'No games in progress') +
      '</h3><p>' +
      (!rooms.length
        ? 'Create a room to start the first match.'
        : 'Other rooms are available in All rooms.') +
      '</p></div></div>'
    );
  return list
    .map(
      (r) =>
        '<div class="room-row"><div class="room-glyph">' +
        i(r.open ? 'room' : 'lock', 22) +
        '</div><div class="room-identity"><strong>' +
        e(r.name) +
        '</strong><small>' +
        (r.botCount
          ? count(r.players - r.botCount, 'human') + ' · ' + count(r.botCount, 'bot')
          : count(r.players, 'player')) +
        ' · ' +
        (r.open ? 'Public' : 'Private') +
        '</small></div>' +
        button(
          'join',
          r.game ? 'Spectate' : 'Join room',
          r.game ? 'eye' : null,
          'btn compact',
        ).replace('data-action="join"', 'data-action="join" data-name="' + e(r.name) + '"') +
        '</div>',
    )
    .join('');
}
export function roomShell(room) {
  return (
    '<div class="crumb"><a href="#/">Lobby</a><b>/</b> Room</div><div class="page-heading"><div><div class="eyebrow"><span class="slashes">///</span> READY ROOM</div><h1>' +
    e(room.name) +
    '</h1></div><div class="actions">' +
    button('invite', 'Invite', 'copy', 'btn ghost') +
    button('leave', 'Leave', 'exit', 'btn ghost') +
    '</div></div>' +
    '<div class="room-cols"><section class="panel"><div class="panel-heading"><div class="section-icon">' +
    i('users') +
    '</div><h2>Riders</h2><span class="tag" id="rider-count"></span>' +
    button('settings', 'Room settings', 'settings', 'mini push') +
    '</div><div id="roster"></div><div class="room-tools"><form id="add-player" class="inline"><input aria-label="Local player name" name="name" maxlength="25" placeholder="Local player name" required><button class="btn compact">' +
    i('plus') +
    'Add rider</button></form><button hidden class="btn ghost" id="add-bot" data-action="bot">Add bot</button><div id="launch"></div></div>' +
    '<details class="driving-tools"><summary>Driving examples</summary><p>Record your primary rider’s steering for imitation training. Examples stay in this tab until you export them.</p><label><input id="record-driving" type="checkbox"> Record my steering</label> <button data-action="export-driving" class="mini">Export examples</button></details></section>' +
    chatShell() +
    '</div>'
  );
}
export function roster(state) {
  const { room, master, id } = state;
  if (!room.players.length)
    return '<div class="empty">' + i('users', 26) + '<p>Add a rider to enter the arena.</p></div>';
  return room.players
    .map((p) => {
      const local = p.client === id;
      if (p.difficulty)
        return (
          '<div class="rider"><span class="color-bar" style="background:' +
          e(p.color) +
          '"></span><div class="rider-name"><strong>' +
          e(p.name) +
          '</strong><small>Computer rider · ' +
          e(difficulties[p.difficulty].label) +
          '</small></div><span class="badge green">Ready</span>' +
          (id === master
            ? '<button class="mini" data-action="bot" data-id="' + p.id + '">Edit bot</button>'
            : '') +
          '</div>'
        );
      return (
        '<div class="rider"><span class="color-bar" style="background:' +
        e(p.color) +
        '"></span><div class="rider-name"><strong>' +
        e(p.name) +
        '</strong><small>' +
        (local ? 'Local rider' : 'Remote rider') +
        (p.client === master ? ' · Host' : '') +
        (p.active === false ? ' · Away' : '') +
        (state.votes.has(p.id) ? ' · Kick vote open' : '') +
        '</small></div>' +
        (local
          ? '<button class="key-btn" data-action="rider" data-id="' +
            p.id +
            '" title="Edit rider and controls">' +
            keycaps(p.keys) +
            i('edit', 14) +
            '</button><button data-action="ready" data-id="' +
            p.id +
            '" class="btn compact ' +
            (p.ready ? 'on' : 'primary') +
            '">' +
            (p.ready ? 'Unready' : 'Ready') +
            '</button>'
          : '<span class="badge ' +
            (p.ready ? 'green' : '') +
            '">' +
            (p.ready ? 'Ready' : 'Waiting') +
            '</span>' +
            (room.players.some((q) => q.client === id)
              ? '<button class="mini" data-action="kick" data-id="' +
                p.id +
                '">' +
                (master === id ? 'Kick' : state.voted.has(p.id) ? 'Cancel vote' : 'Vote kick') +
                '</button>'
              : '')) +
        '</div>'
      );
    })
    .join('');
}
export function botForm(bot) {
  const selected = bot?.difficulty || 'normal';
  return (
    '<form id="bot-form"' +
    (bot ? ' data-id="' + bot.id + '"' : '') +
    '><fieldset class="bot-options"><legend>Difficulty</legend>' +
    Object.entries(difficulties)
      .map(
        ([id, d]) =>
          '<label><input type="radio" name="difficulty" value="' +
          id +
          '"' +
          (selected === id ? ' checked' : '') +
          '><span><strong>' +
          d.label +
          ' · ' +
          d.method +
          '</strong><small>' +
          d.description +
          '</small></span></label>',
      )
      .join('') +
    '</fieldset><div class="form-actions">' +
    (bot
      ? '<button type="button" class="mini" data-action="remove-bot" data-id="' +
        bot.id +
        '">Remove bot</button>'
      : '') +
    '<button class="btn primary">' +
    (bot ? 'Save changes' : 'Add bot') +
    '</button></div></form>'
  );
}

export function chatShell() {
  return (
    '<section class="panel chat"><div class="panel-heading"><div class="section-icon">' +
    i('chat') +
    '</div><h2>Room chat</h2></div><div id="feed" role="log"></div><form id="talk" class="inline"><input name="msg" maxlength="140" aria-label="Chat message" placeholder="Message the room…" required autocomplete="off"><button class="btn compact" aria-label="Send message">' +
    i('chat') +
    '</button></form></section>'
  );
}
export function chatLines(state) {
  return (
    state.messages
      .filter((m) => !state.muted.has(m.client))
      .map((m) => {
        return (
          '<div class="message">' +
          (m.system
            ? '<span class="sys">SYSTEM</span>'
            : '<button class="author" style="color:' +
              e(m.color || '#b5ced7') +
              '" data-action="mute" data-id="' +
              m.client +
              '" title="Mute this sender">' +
              e(m.name || 'Spectator ' + m.client) +
              '</button>') +
          ' <span>' +
          e(m.content) +
          '</span> <time>' +
          e(new Date(m.creation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) +
          '</time></div>'
        );
      })
      .join('') +
    [...state.muted]
      .map(
        (id) =>
          '<button class="text-btn" data-action="mute" data-id="' +
          id +
          '">Unmute ' +
          e(state.messages.findLast((m) => m.client === id)?.name || 'Spectator ' + id) +
          '</button>',
      )
      .join('')
  );
}
export function settings(state) {
  const c = state.room.config,
    disabled = state.master === state.id ? '' : ' disabled';
  const active = Object.keys(c.bonuses).filter((k) => c.bonuses[k]);
  const current =
    Object.keys(presets).find(
      (k) => presets[k].length === active.length && presets[k].every((b) => active.includes(b)),
    ) || 'Custom';
  return (
    '<fieldset class="settings"' +
    disabled +
    '><div class="field-row"><label>Victory score<input type="number" min="1" id="score-setting" placeholder="Auto · ' +
    Math.max(1, (state.room.players.length - 1) * 10) +
    '" value="' +
    (c.maxScore || '') +
    '"></label><label>Room access<select id="access"><option value="open" ' +
    (c.open ? 'selected' : '') +
    '>Public</option><option value="private" ' +
    (!c.open ? 'selected' : '') +
    '>Private</option></select></label></div>' +
    (!c.open ? '<p>Room code <b class="code">' + e(c.password) + '</b></p>' : '') +
    '<label>Bonus frequency<input type="range" min="-1" max="1" step=".1" id="rate" value="' +
    c.variables.bonusRate +
    '"></label><label>Bonus preset<select id="preset">' +
    (current === 'Custom' ? '<option>Custom</option>' : '') +
    Object.keys(presets)
      .map((k) => '<option ' + (k === current ? 'selected' : '') + '>' + e(k) + '</option>')
      .join('') +
    '</select></label><div class="bonus-grid">' +
    Object.entries(bonuses)
      .map(
        ([k, v], idx) =>
          '<label><input type="checkbox" data-bonus="' +
          k +
          '" ' +
          (c.bonuses[k] ? 'checked' : '') +
          '><b class="sprite" style="--col:' +
          (idx % 3) +
          ';--row:' +
          Math.floor(idx / 3) +
          '"></b>' +
          e(v) +
          '</label>',
      )
      .join('') +
    '</div></fieldset>'
  );
}
export function matchShell(room) {
  return (
    '<div class="play-layout"><div class="play-viewport"><div class="crumb"><a href="#/">Lobby</a><b>/</b>' +
    e(room.name) +
    '</div><section class="play-panel panel"><div class="play-bar"><div class="eyebrow"><span class="slashes">///</span> ' +
    e(room.name) +
    '</div><div id="round-tag"></div></div><div class="match-arena"><canvas id="arena" aria-label="Isometric game arena"></canvas><div id="banner"></div><div id="kills"></div></div><div class="play-bottom"><span id="metrics"></span><div>' +
    button('audio', '<span class="sr">Toggle effects</span>', 'sound', 'mini') +
    button('leave', 'Leave', 'exit', 'mini') +
    '</div></div><div id="touch-pads"></div></section></div><aside class="play-sidebar"><section class="panel"><div class="panel-heading"><div class="section-icon">' +
    i('flag') +
    '</div><h2>Standings</h2></div><div id="scores"></div></section>' +
    chatShell() +
    '</aside></div>'
  );
}
export function boardScores(m, id) {
  let rank = 0;
  return Object.values(m.racers)
    .sort((a, b) => b.score - a.score)
    .map((r, n, standings) => {
      if (n === 0 || r.score !== standings[n - 1].score) rank = n + 1;
      return (
        '<div class="score-row ' +
        (!r.alive ? 'eliminated' : '') +
        '"><span class="rank">' +
        rank +
        '</span><span class="color-bar" style="background:' +
        e(r.baseColor) +
        '"></span><div><strong>' +
        e(r.name) +
        '</strong><small>' +
        (r.difficulty
          ? difficulties[r.difficulty].label + ' bot · '
          : r.client === id
            ? 'You · '
            : '') +
        (r.present ? (r.alive ? 'Riding' : 'Out') : 'Left') +
        '</small>' +
        Object.values(r.effects)
          .map(
            (f) =>
              '<span class="active-effect" title="' +
              e(bonuses[f.type]) +
              '">' +
              e(bonuses[f.type]) +
              '</span>',
          )
          .join('') +
        '</div><span class="points" title="Match total">' +
        r.score +
        (r.points ? ' <small title="Points earned this round">+' + r.points + '</small>' : '') +
        '</span></div>'
      );
    })
    .join('');
}
export function banner(m) {
  const winner = m.racers[m.winner],
    racers = Object.values(m.racers);
  if (m.phase === 'warmup') {
    const tie = racers.filter((r) => r.present && r.score >= m.maxScore).length > 1;
    return (
      '<div class="countdown"><small>' +
      (tie ? 'TIE BREAK' : 'ROUND ' + m.round) +
      '</small><strong>' +
      Math.max(1, Math.ceil((m.countdownEnd - Date.now()) / 1000)) +
      '</strong></div>'
    );
  }
  if (m.phase === 'loading')
    return (
      '<div class="recap"><small>LOADING ARENA</small><h2>Waiting for riders</h2><p>' +
      e(
        racers
          .filter((r) => !r.loaded)
          .map((r) => r.name)
          .join(', '),
      ) +
      '</p></div>'
    );
  if (m.phase === 'racing') return m.cleanageddon ? '<div class="danger">Cleanageddon</div>' : '';
  return (
    '<div class="recap"><small>' +
    (m.phase === 'finished' ? 'FINAL STANDINGS' : 'ROUND ' + m.round + ' COMPLETE') +
    '</small><h2>' +
    e(
      winner
        ? winner.name + ' wins'
        : m.phase === 'finished'
          ? 'Match complete'
          : 'Everyone crashed',
    ) +
    '</h2>' +
    (m.phase === 'finished'
      ? button('back-room', 'Back to room', null, 'btn primary')
      : '<p>Next round shortly</p>') +
    '</div>'
  );
}
export function guide(keys) {
  const lessons = [
    {
      id: 'steer',
      title: 'Steer your cycle',
      body: 'Your cycle moves forward on its own. Hold left or right to turn. Release to ride straight.',
      detail:
        '<div class="guide-keys"><span>Left ' +
        keycaps([keys[0]]) +
        '</span><span>Right ' +
        keycaps([keys[1]]) +
        '</span></div>',
    },
    {
      id: 'gap',
      title: 'Find a gap',
      body: 'Aim for an opening. Hitting a wall or any solid trail ends your run, even if the trail is yours.',
    },
    {
      id: 'pickup',
      title: 'Collect pickups',
      body: 'Ride over a pickup to activate it. Its color shows who it affects.',
      detail:
        '<ul class="guide-legend"><li><b>Green</b> You</li><li><b>Red</b> Opponents</li><li><b>White</b> Everyone</li></ul>',
    },
  ];
  return `<div class="guide-lessons">${lessons
    .map(
      ({ id, title, body, detail = '' }) => `
    <article class="guide-lesson">
      <div class="guide-stage"><canvas data-lesson="${id}" aria-hidden="true"></canvas></div>
      <div class="guide-copy"><h3>${title}</h3><p>${body}</p>${detail}</div>
    </article>`,
    )
    .join('')}</div>
    <section class="guide-scoring">
      ${i('flag', 22)}
      <div><h3>Win the match</h3><p>Earn one point for each rider you outlast. Riders who crash together earn the same points. A solo round earns one point.</p>
      <p>Reach the victory score with more points than every other rider to win. Tied leaders play another round.</p></div>
    </section>`;
}
