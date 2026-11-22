import { defaults } from './controls.js';
import { palette } from './catalog.js';

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
function previousKey(control, index) {
  const k = control?.value;
  if (control?.mapper === 'keyboard') {
    if (k >= 65 && k <= 90) return 'Key' + String.fromCharCode(k);
    if (k >= 48 && k <= 57) return 'Digit' + String.fromCharCode(k);
    return (
      { 37: 'ArrowLeft', 39: 'ArrowRight', 38: 'ArrowUp', 40: 'ArrowDown', 32: 'Space' }[k] ||
      defaults[0][index]
    );
  }
  if (control?.mapper === 'gamepad') {
    const button = /^(?:gamepad:(\d+):)?button:(\d+)$/.exec(k);
    if (button) return 'Pad' + (button[1] || 0) + 'Button' + button[2];
    const axis = /^(?:gamepad:(\d+):)?axis:(\d+):(-?1)$/.exec(k);
    if (axis) return 'Pad' + (axis[1] || 0) + 'Axis' + axis[2] + (axis[3] === '1' ? '+' : '-');
  }
  if (control?.mapper === 'touch') return index ? 'TouchRight' : 'TouchLeft';
  return defaults[0][index];
}
export function loadProfile() {
  const old = read('PROFILE') || {},
    saved = read('fronttron.profile') || old;
  return {
    name:
      typeof saved.name === 'string' && saved.name.trim()
        ? saved.name.trim().slice(0, 25)
        : 'Rider ' + Math.floor(1000 + Math.random() * 9000),
    color: /^#[a-f0-9]{6}$/i.test(saved.color) ? saved.color : palette[0],
    keys:
      Array.isArray(saved.keys) &&
      saved.keys.length === 2 &&
      saved.keys.every((k) => typeof k === 'string')
        ? saved.keys
        : old.controls?.length === 2
          ? old.controls.map(previousKey)
          : matchMedia('(pointer:coarse)').matches
            ? ['TouchLeft', 'TouchRight']
            : [...defaults[0]],
    sound: saved.sound !== false,
  };
}
export function saveProfile(profile) {
  try {
    localStorage.setItem('fronttron.profile', JSON.stringify(profile));
  } catch {}
}
