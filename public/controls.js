export const defaults = [
  ['ArrowLeft', 'ArrowRight'],
  ['KeyA', 'KeyD'],
  ['KeyJ', 'KeyL'],
  ['KeyV', 'KeyN'],
];
export function label(code) {
  return (
    {
      ArrowLeft: '←',
      ArrowRight: '→',
      TouchLeft: 'Touch L',
      TouchRight: 'Touch R',
      Space: 'Space',
    }[code] ||
    code
      .replace(/^Key|^Digit/, '')
      .replace(/^Pad(\d+)Button(\d+)$/, (_, p, b) => 'Pad ' + (+p + 1) + ' · B' + (+b + 1))
      .replace(/^Pad(\d+)Axis(\d+)([+-])$/, (_, p, a, s) => 'Pad ' + (+p + 1) + ' · A' + a + s)
  );
}
function padKeys() {
  const keys = [];
  let pads;
  try {
    pads = navigator.getGamepads?.() || [];
  } catch {
    return keys;
  }
  for (const pad of pads) {
    if (!pad) continue;
    pad.buttons.forEach((b, i) => {
      if (b.pressed) keys.push('Pad' + pad.index + 'Button' + i);
    });
    pad.axes.forEach((a, i) => {
      if (Math.abs(a) > 0.45) keys.push('Pad' + pad.index + 'Axis' + i + (a < 0 ? '-' : '+'));
    });
  }
  return keys;
}
export function controls(players, send, canSteer, onActivity) {
  const held = new Set(),
    sent = new Map(),
    fingers = new Map();
  let capture = null,
    pad = new Set(),
    frame;
  function update() {
    for (const p of players()) {
      const [left, right] = p.keys;
      const move = canSteer() ? Number(held.has(right)) - Number(held.has(left)) : 0;
      if ((sent.get(p.id) || 0) !== move) {
        send(p.id, move);
        sent.set(p.id, move);
      }
    }
  }
  function bind(code) {
    if (!capture) return false;
    const done = capture;
    capture = null;
    done(code);
    return true;
  }
  function key(e, on) {
    if (on && capture) {
      e.preventDefault();
      if (e.code === 'Escape') {
        capture = null;
        document.querySelector('dialog[open]')?.close();
      } else bind(e.code);
      return;
    }
    if (on && (e.target.matches?.('input, textarea, select, [contenteditable]') || !canSteer()))
      return;
    if (!players().some((p) => p.keys.includes(e.code))) return;
    if (canSteer()) e.preventDefault();
    on ? held.add(e.code) : held.delete(e.code);
    update();
  }
  window.addEventListener('keydown', (e) => key(e, true));
  window.addEventListener('keyup', (e) => key(e, false));
  function release() {
    held.clear();
    fingers.clear();
    update();
  }
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) release();
  });
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('input,textarea,select')) release();
  });
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest?.('.play-panel')) e.preventDefault();
  });
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest?.('[data-touch], .match-arena');
    if (!target || e.button !== 0 || !canSteer()) return;
    e.preventDefault();
    if (document.activeElement?.matches('input, textarea, select, [contenteditable]'))
      document.activeElement.blur();
    const box = target.getBoundingClientRect();
    const code =
      target.dataset.touch || (e.clientX < box.left + box.width / 2 ? 'TouchLeft' : 'TouchRight');
    target.setPointerCapture(e.pointerId);
    fingers.set(e.pointerId, code);
    held.add(code);
    update();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    document.addEventListener(type, (e) => {
      const code = fingers.get(e.pointerId);
      if (!code) return;
      fingers.delete(e.pointerId);
      if (![...fingers.values()].includes(code)) held.delete(code);
      update();
    });
  function poll() {
    const next = new Set(padKeys());
    for (const code of next)
      if (!pad.has(code)) {
        onActivity();
        if (!bind(code)) held.add(code);
      }
    for (const code of pad) if (!next.has(code)) held.delete(code);
    if (next.size || pad.size) update();
    pad = next;
    frame = requestAnimationFrame(poll);
  }
  frame = requestAnimationFrame(poll);
  return {
    listen(fn) {
      release();
      capture = fn;
    },
    cancel() {
      capture = null;
    },
    reset() {
      release();
      sent.clear();
    },
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}
