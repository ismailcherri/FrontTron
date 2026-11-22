const shapes = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  book: '<path d="M3 4.5c3.5-1.2 6-.7 9 1 3-1.7 5.5-2.2 9-1v14.8c-3.4-1.2-6.1-.7-9 1-2.9-1.7-5.6-2.2-9-1zM12 5.5v15"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c0-4.1 3.4-6.1 7.2-6.1s7.2 2 7.2 6.1"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M2 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 5 5"/>',
  pulse: '<path d="M2 13h4l3-8 5 14 3-8h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  layers: '<path d="m2 9 10-5 10 5-10 5zM3 13l9 4.5 9-4.5M3 17l9 4.5 9-4.5"/>',
  room: '<path d="m3 8 9-5 9 5-9 5zM3 8v8l9 5 9-5V8M12 13v8"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  play: '<path d="m7 4 13 8-13 8z"/>',
  key: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 10h1m3 0h1m3 0h1m3 0h1M6 14h2m2 0h6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  edit: '<path d="m4 16-1 5 5-1L21 7l-4-4zM14 6l4 4"/>',
  settings:
    '<path d="M3 7h7m5 0h6M3 17h11m5 0h2"/><circle cx="12.5" cy="7" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/>',
  chat: '<path d="M3 4h18v13H9l-6 4z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 5V3H3v13h2"/>',
  flag: '<path d="M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  exit: '<path d="M10 3H4v18h6m4-14 5 5-5 5m-5-5h10"/>',
};
export function icon(name, size = 18) {
  return (
    '<svg class="icon" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (shapes[name] || '') +
    '</svg>'
  );
}
export function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s],
  );
}
