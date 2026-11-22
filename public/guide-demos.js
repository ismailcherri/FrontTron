import { createArenaPainter, pickupArtReady } from './arena.js';
import { icon } from './icons.js';

const size = 44;
const gold = '#ffbd49',
  teal = '#42e8d1',
  pink = '#ff75b2';
const stroke = (points, color) => ({ points, color, radius: 0.65 });

// Travel straight, turn through a semicircle, then leave the turn on its tangent.
function steeringRoute(t) {
  const radius = 8,
    arc = Math.PI * radius,
    distance = t * (26 + arc);
  if (distance <= 13) return [9 + distance, 12, 0];
  if (distance >= 13 + arc) return [22 - (distance - 13 - arc), 28, Math.PI];
  const angle = (distance - 13) / radius;
  return [22 + radius * Math.sin(angle), 20 - radius * Math.cos(angle), angle];
}

const lessons = {
  steer: { color: gold, route: steeringRoute, start: 0.65 },
  gap: {
    color: teal,
    start: 0.56,
    route: (t) => [22, 39 - t * 34, -Math.PI / 2],
    obstacles: [stroke([3, 22, 16, 22], pink), stroke([28, 22, 41, 22], pink)],
  },
  pickup: {
    color: gold,
    start: 0.39,
    route: (t) => [5 + t * 33, 24, 0],
    item: { x: 26, y: 24, type: 'BonusSelfFast' },
  },
};

function sceneAt(lesson, phase) {
  const { color, route, item } = lesson;
  const [x, y, angle] = route(phase);
  const points = [];
  for (let i = 0; i <= 54; i++) {
    const [u, v] = route((phase * i) / 54);
    points.push(u, v);
  }
  return {
    size,
    trails: [...(lesson.obstacles || []), stroke(points, color)],
    pickups: item && x < item.x - 2 ? [item] : [],
    racers: [{ x, y, angle, color, alive: true }],
  };
}

export function mountGuide(dialog) {
  const drawings = [...dialog.querySelectorAll('[data-lesson]')].map((canvas) => ({
    paint: createArenaPainter(canvas, true),
    lesson: lessons[canvas.dataset.lesson],
  }));
  const button = dialog.querySelector('#guide-playback');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !motion.matches,
    frame,
    previous,
    elapsed = 0,
    mounted = true;

  function paint() {
    // Start on explanatory frames even when animations are paused.
    drawings.forEach(({ paint, lesson }) => {
      let phase = (lesson.start + elapsed / 5200) % 1;
      // The green afterburner accelerates the bike immediately after collection.
      if (lesson.item) {
        const contact = (lesson.item.x - 2 - 5) / 33;
        const duration = contact + (1 - contact) / 1.75;
        const progress = phase * duration;
        phase = progress <= contact ? progress : contact + (progress - contact) * 1.75;
      }
      paint(sceneAt(lesson, phase), elapsed);
    });
  }
  function animate(now) {
    if (previous !== undefined) elapsed += Math.min(now - previous, 64);
    previous = now;
    paint();
    frame = requestAnimationFrame(animate);
  }
  function syncPlayback() {
    cancelAnimationFrame(frame);
    previous = undefined;
    const action = playing ? 'Pause' : 'Play';
    button.innerHTML = icon(playing ? 'pause' : 'play', 15) + '<span>' + action + ' demos</span>';
    button.setAttribute('aria-label', action + ' demos');
    paint();
    if (playing) frame = requestAnimationFrame(animate);
  }
  function toggle() {
    playing = !playing;
    syncPlayback();
  }
  function preferMotion() {
    playing = !motion.matches;
    syncPlayback();
  }

  const observer = new ResizeObserver(paint);
  observer.observe(dialog);
  button.addEventListener('click', toggle);
  motion.addEventListener('change', preferMotion);
  // A paused guide can open before the arena's pickup atlas finishes loading.
  pickupArtReady.then(() => {
    if (mounted && !playing) paint();
  });
  syncPlayback();
  return () => {
    mounted = false;
    cancelAnimationFrame(frame);
    observer.disconnect();
    button.removeEventListener('click', toggle);
    motion.removeEventListener('change', preferMotion);
  };
}
