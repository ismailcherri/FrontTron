import test from 'node:test';
import assert from 'node:assert/strict';
import { controls } from '../public/controls.js';

test('independent local keyboard, touch and gamepad inputs turn and release', () => {
  // Exercise the production input adapter with browser-shaped input events.
  const windowEvents = new EventTarget(),
    docEvents = new EventTarget();
  const pad = { index: 0, buttons: [{ pressed: false }], axes: [0] };
  const saved = new Map();
  let nextFrame;
  for (const [key, value] of Object.entries({
    window: windowEvents,
    document: docEvents,
    navigator: { getGamepads: () => [pad] },
    requestAnimationFrame: (fn) => {
      nextFrame = fn;
      return 1;
    },
    cancelAnimationFrame: () => {},
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const moves = [];
  const input = controls(
    () => [
      { id: 1, keys: ['ArrowLeft', 'ArrowRight'] },
      { id: 2, keys: ['KeyA', 'KeyD'] },
      { id: 3, keys: ['TouchLeft', 'TouchRight'] },
      { id: 4, keys: ['Pad0Axis0-', 'Pad0Button0'] },
    ],
    (id, direction) => moves.push([id, direction]),
    () => true,
    () => {},
  );
  function key(type, code) {
    const ev = Object.assign(new Event(type), { code });
    windowEvents.dispatchEvent(ev);
  }
  function pointer(type, pointerId, clientX) {
    const ev = Object.assign(new Event(type), { pointerId, clientX });
    docEvents.dispatchEvent(ev);
  }
  try {
    key('keydown', 'ArrowLeft');
    key('keydown', 'KeyD');
    key('keyup', 'KeyD');
    key('keyup', 'ArrowLeft');
    assert.deepEqual(moves.splice(0), [
      [1, -1],
      [2, 1],
      [2, 0],
      [1, 0],
    ]);
    docEvents.closest = () => ({
      dataset: {},
      getBoundingClientRect: () => ({ left: 0, width: 300 }),
      setPointerCapture() {},
    });
    pointer('pointerdown', 1, 30);
    pointer('pointerdown', 2, 270);
    pointer('pointerup', 1, 30);
    pointer('pointercancel', 2, 270);
    assert.deepEqual(moves.splice(0), [
      [3, -1],
      [3, 0],
      [3, 1],
      [3, 0],
    ]);
    pad.axes[0] = -0.8;
    nextFrame();
    pad.axes[0] = 0;
    nextFrame();
    pad.buttons[0].pressed = true;
    nextFrame();
    windowEvents.dispatchEvent(new Event('blur'));
    assert.deepEqual(moves.splice(0), [
      [4, -1],
      [4, 0],
      [4, 1],
      [4, 0],
    ]);
    let mapped = null;
    input.listen((code) => {
      mapped = code;
    });
    pad.buttons[0].pressed = false;
    nextFrame();
    pad.buttons[0].pressed = true;
    nextFrame();
    assert.equal(mapped, 'Pad0Button0');
    assert.deepEqual(moves, []);
  } finally {
    input.stop();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
