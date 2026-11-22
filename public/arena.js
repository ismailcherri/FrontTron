import { bonuses } from './catalog.js';

const sprite = new Image();
sprite.src = '/art/bonus.png';
export const pickupArtReady = sprite.decode().catch(() => {});
const spriteNames = Object.keys(bonuses);
const ink = '#101820';
const A = 0.89,
  B = 0.42,
  C = -0.75,
  D = 0.5;
const tau = Math.PI * 2;
const lipRatio = 0.045;
const baseDepthRatio = lipRatio * 1.4;
function poly(c, points, color, stroke) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 0.18;
    c.stroke();
  }
}
function line(c, x, y, xx, yy, color, width) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(xx, yy);
  c.stroke();
}
function matrix(c, scale, x, y, z = 0) {
  c.transform(A * scale, B * scale, C * scale, D * scale, x, y - z * scale);
}
function camera(w, h, size, demo) {
  // Frame the full deck, including its base and the raised pickups at the back edge.
  const pad = demo ? 0 : Math.max(6, Math.min(w, h) * 0.012);
  const width = demo ? size * 1.82 : (A - C) * size + 4;
  const headroom = 5.4;
  const height = demo ? size * 1.13 : (B + D + baseDepthRatio) * size + headroom;
  const scale = Math.min((w - 2 * pad) / width, (h - 2 * pad) / height);
  return {
    scale,
    x: (w - (A + C) * size * scale) / 2,
    y: demo
      ? (h - (B + D) * size * scale) / 2 - 2 * scale
      : (h - height * scale) / 2 + headroom * scale,
  };
}
function face(c, view, points, color) {
  const { x, y, scale } = view;
  poly(
    c,
    points.map(([u, v, z]) => [x + (A * u + C * v) * scale, y + (B * u + D * v - z) * scale]),
    color,
  );
}
function deck(c, v, size, borderless) {
  const n = size,
    lip = size * lipRatio;
  const sides = (top, bottom, left, right) => {
    face(
      c,
      v,
      [
        [0, n, top],
        [n, n, top],
        [n, n, bottom],
        [0, n, bottom],
      ],
      left,
    );
    face(
      c,
      v,
      [
        [n, n, top],
        [n, 0, top],
        [n, 0, bottom],
        [n, n, bottom],
      ],
      right,
    );
  };
  sides(-lip * 0.7, -size * baseDepthRatio, '#111722', '#19212c');
  sides(-lip * 0.55, -lip * 0.7, '#896b38', '#735126');
  sides(0, -lip * 0.55, '#36414c', '#232b35');
  for (let i = 1; i < 32; i++) {
    const a = (n * i) / 32,
      bright = i % 6 === 0;
    face(
      c,
      v,
      [
        [a, n, -lip * 0.12],
        [a + n * 0.015, n, -lip * 0.12],
        [a + n * 0.012, n, -lip * 0.41],
        [a - n * 0.003, n, -lip * 0.41],
      ],
      bright ? '#efb343' : '#131a23',
    );
    face(
      c,
      v,
      [
        [n, a, -lip * 0.12],
        [n, a + n * 0.012, -lip * 0.12],
        [n, a + n * 0.015, -lip * 0.41],
        [n, a + n * 0.003, -lip * 0.41],
      ],
      bright ? '#d6a146' : '#111820',
    );
  }
  c.save();
  matrix(c, v.scale, v.x, v.y);
  const grad = c.createLinearGradient(0, 0, n, n);
  grad.addColorStop(0, '#32414b');
  grad.addColorStop(0.5, '#28343e');
  grad.addColorStop(1, '#192630');
  c.fillStyle = grad;
  c.fillRect(0, 0, n, n);
  const tiles = 24;
  for (let i = 0; i <= tiles; i++) {
    const a = (n * i) / tiles,
      strong = i % 4 === 0;
    const color = strong ? '#50606a' : '#3b4954';
    line(c, a, 0, a, n, color, strong ? 0.14 : 0.08);
    line(c, 0, a, n, a, color, strong ? 0.14 : 0.08);
  }
  for (let i = 2; i < tiles; i += 4)
    for (let j = 2; j < tiles; j += 4) {
      const x = (n * i) / tiles,
        y = (n * j) / tiles;
      line(c, x - 0.45, y, x + 0.45, y, '#71828d', 0.12);
      line(c, x, y - 0.45, x, y + 0.45, '#71828d', 0.12);
    }
  c.strokeStyle = borderless ? '#64edce' : '#8b8f84';
  c.lineWidth = 0.43;
  c.setLineDash(borderless ? [1, 1] : []);
  c.strokeRect(0, 0, n, n);
  c.setLineDash([]);
  c.strokeStyle = '#50606a';
  c.lineWidth = 0.13;
  c.strokeRect(0.9, 0.9, n - 1.8, n - 1.8);
  for (const [x, y, ang] of [
    [0, 0, 0],
    [n, 0, Math.PI / 2],
    [n, n, Math.PI],
    [0, n, -Math.PI / 2],
  ]) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    poly(
      c,
      [
        [0, 0],
        [5, 0],
        [5, 0.65],
        [1.4, 1.4],
        [0.65, 5],
        [0, 5],
      ],
      '#e8b856',
    );
    c.restore();
  }
  c.restore();
}
function path(c, points) {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
}
function trails(c, list, v, preview) {
  c.save();
  matrix(c, v.scale, v.x, v.y);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const t of list) {
    if (t.points.length < 4) continue;
    path(c, t.points);
    c.strokeStyle = t.color;
    c.globalAlpha = 0.12;
    c.lineWidth = t.radius * 5;
    c.stroke();
    c.globalAlpha = 1;
    c.lineWidth = t.radius * 2;
    c.stroke();
    c.save();
    const height = preview ? 1.85 : 0.64;
    const dx = (-height * 0.75) / (A * D - B * C),
      dy = (-height * A) / (A * D - B * C);
    // A vertical ribbon joins the footprint to the illuminated top edge.
    c.beginPath();
    for (let i = 0; i < t.points.length; i += 2) {
      if (i === 0) c.moveTo(t.points[i], t.points[i + 1]);
      else c.lineTo(t.points[i], t.points[i + 1]);
    }
    for (let i = t.points.length - 2; i >= 0; i -= 2)
      c.lineTo(t.points[i] + dx, t.points[i + 1] + dy);
    c.closePath();
    c.fillStyle = t.color;
    c.globalAlpha = 0.7;
    c.fill();
    c.globalAlpha = 1;
    c.translate(dx, dy);
    path(c, t.points);
    c.strokeStyle = t.color;
    c.lineWidth = t.radius * (preview ? 1.55 : 1.35);
    c.shadowColor = t.color;
    c.shadowBlur = preview ? 7 : 3;
    c.stroke();
    c.shadowBlur = 0;
    c.lineWidth = t.radius * 0.32;
    c.globalAlpha = 0.75;
    if (t.color !== '#000000') {
      c.strokeStyle = '#ffffff';
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}
function bikeScale(radius, demo) {
  return demo ? 2.15 : radius * 1.2;
}

// Each bike is built from raised polygon faces in the same world as its trail.
function bike(c, r, v, demo) {
  if (!r.alive || r.x === null) return;
  const size = bikeScale(r.radius, demo);
  const cos = Math.cos(r.angle),
    sin = Math.sin(r.angle);
  const project = ([x, y, z]) => [
    r.x + size * (x * cos - y * sin),
    r.y + size * (x * sin + y * cos),
    z * size,
  ];
  const part = (points, color) => face(c, v, points.map(project), color);
  const walls = (outline, z, h, base, top) => {
    const sides = outline.map(([x, y], i) => {
      const [u, w] = outline[(i + 1) % outline.length];
      return [
        [x, y, z],
        [u, w, z],
        [u, w, z + h],
        [x, y, z + h],
      ];
    });
    sides.sort((a, b) => {
      const depth = (p) => {
        const [x, y] = project(p[0]);
        return B * x + D * y;
      };
      return depth(a) - depth(b);
    });
    for (const s of sides) part(s, base);
    part(
      outline.map(([x, y]) => [x, y, z + h]),
      top,
    );
  };
  const hull = [
    [-2, -0.7],
    [-1.3, -1],
    [1.3, -0.84],
    [2.1, -0.32],
    [2.1, 0.32],
    [1.3, 0.84],
    [-1.3, 1],
    [-2, 0.7],
  ];
  walls(hull, 0.05, 0.64, '#0b1018', '#515d66');
  const stripe = [
    [-1.9, -0.8],
    [1.2, -0.76],
    [1.8, -0.35],
    [1.5, -0.2],
    [-1.85, -0.47],
  ];
  part(
    stripe.map(([x, y]) => [x, y, 0.76]),
    r.color,
  );
  part(
    stripe.map(([x, y]) => [x, -y, 0.76]),
    r.color,
  );
  walls(
    [
      [-0.97, -0.5],
      [0.42, -0.54],
      [1, 0.02],
      [0.34, 0.53],
      [-0.97, 0.46],
    ],
    0.68,
    0.46,
    '#171e27',
    '#bcc8d1',
  );
  part(
    [
      [-0.7, -0.39, 1.17],
      [0.22, -0.38, 1.17],
      [0.62, 0, 1.17],
      [0.12, 0.35, 1.17],
      [-0.71, 0.28, 1.17],
    ],
    '#354f60',
  );
  part(
    [
      [1.65, -0.36, 0.76],
      [2.1, -0.18, 0.72],
      [2.1, 0.18, 0.72],
      [1.65, 0.36, 0.76],
    ],
    '#fffae2',
  );
  if (r.invincible) {
    c.save();
    matrix(c, v.scale, v.x, v.y);
    c.strokeStyle = '#f7f9f5';
    c.lineWidth = 0.15;
    c.beginPath();
    c.arc(r.x, r.y, 2.8 * size, 0, tau);
    c.stroke();
    c.restore();
  }
}
function pickup(c, p, v, rad) {
  const x = v.x + (A * p.x + C * p.y) * v.scale,
    y = v.y + (B * p.x + D * p.y) * v.scale;
  c.fillStyle = '#07151ca6';
  c.beginPath();
  c.ellipse(x, y, rad * 0.88, rad * 0.38, 0, 0, tau);
  c.fill();
  const i = spriteNames.indexOf(p.type);
  if (sprite.complete && sprite.naturalWidth && i >= 0) {
    const sw = sprite.naturalWidth / 3,
      sh = sprite.naturalHeight / 6;
    c.drawImage(
      sprite,
      (i % 3) * sw,
      Math.floor(i / 3) * sh,
      sw,
      sh,
      x - rad,
      y - rad * 1.8,
      rad * 2,
      rad * 2,
    );
  }
}
function demoPath(commands) {
  // Sample smooth curves into an arc-length path, so the attract-mode bikes have constant speed.
  let [x, y] = commands[0],
    out = [[x, y, 0]],
    length = 0;
  for (const [a, b, d, e, f, g] of commands.slice(1)) {
    const x0 = x,
      y0 = y;
    for (let j = 1; j <= 48; j++) {
      const t = j / 48,
        s = 1 - t;
      const nx = s * s * s * x0 + 3 * s * s * t * a + 3 * s * t * t * d + t * t * t * f;
      const ny = s * s * s * y0 + 3 * s * s * t * b + 3 * s * t * t * e + t * t * t * g;
      length += Math.hypot(nx - x, ny - y);
      x = nx;
      y = ny;
      out.push([x, y, length]);
    }
  }
  return { points: out, length };
}
const loops = [
  {
    color: '#ffba42',
    phase: 0.64,
    route: demoPath([
      [15, 19],
      [15, 8, 34, 7, 40, 14],
      [47, 21, 42, 31, 53, 32],
      [63, 34, 75, 26, 86, 35],
      [98, 48, 81, 60, 70, 55],
      [57, 50, 64, 43, 48, 44],
      [32, 48, 29, 36, 24, 32],
      [20, 28, 15, 26, 15, 19],
    ]),
  },
  {
    color: '#30e6d0',
    phase: 0.28,
    route: demoPath([
      [12, 58],
      [14, 47, 28, 49, 32, 56],
      [37, 65, 44, 69, 56, 64],
      [70, 57, 77, 66, 83, 72],
      [94, 87, 71, 91, 62, 83],
      [53, 76, 47, 86, 35, 82],
      [23, 79, 9, 71, 12, 58],
    ]),
  },
  {
    color: '#fb6dae',
    phase: 0.4,
    route: demoPath([
      [54, 12],
      [61, 7, 76, 10, 82, 14],
      [95, 22, 90, 31, 82, 28],
      [72, 23, 70, 24, 63, 25],
      [53, 27, 45, 19, 54, 12],
    ]),
  },
];
function demoScene(now) {
  const trails = [],
    racers = [];
  for (const track of loops) {
    const { length, points } = track.route;
    const end = (track.phase * length + now * 0.004) % length;
    let coords = [],
      prev = -1;
    for (const [x, y, d] of points) {
      const age = (end - d + length) % length;
      if (age < length * 0.72 && !(age > length * 0.29 && age < length * 0.32)) {
        if (prev >= 0 && d - prev > 4) coords = [];
        if (!coords.length) trails.push({ color: track.color, radius: 0.8, points: coords });
        coords.push(x, y);
        prev = d;
      } else {
        coords = [];
        prev = -1;
      }
    }
    const idx = Math.max(
        1,
        points.findIndex((p) => p[2] >= end),
      ),
      [x, y] = points[idx],
      [px, py] = points[idx - 1];
    racers.push({ x, y, alive: true, angle: Math.atan2(y - py, x - px), color: track.color });
  }
  return { size: 100, trails, racers, pickups: {} };
}

// The match, lobby preview, and field guide share the same camera and arena artwork.
export function createArenaPainter(canvas, demo = false) {
  const ctx = canvas.getContext('2d');
  let cachedDeck, deckKey;
  return (scene, now) => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const key = [w, h, dpr, scene.size, scene.borderless].join(',');
    const v = camera(w, h, scene.size, demo);
    if (key !== deckKey) {
      deckKey = key;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      cachedDeck = document.createElement('canvas');
      cachedDeck.width = canvas.width;
      cachedDeck.height = canvas.height;
      const dc = cachedDeck.getContext('2d');
      dc.scale(dpr, dpr);
      deck(dc, v, scene.size, scene.borderless);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(cachedDeck, 0, 0, w, h);
    trails(ctx, scene.trails, v, demo);
    // The field guide uses enlarged bikes and props for its miniature lessons.
    const pickupRadius = (demo ? 3 : 1.2) * v.scale;
    for (const p of Object.values(scene.pickups)) pickup(ctx, p, v, pickupRadius);
    const racers = Object.values(scene.racers).sort((a, b) => (a.x - b.x) * B + (a.y - b.y) * D);
    for (const r of racers) {
      bike(ctx, r, v, demo);
      if (!demo && scene.phase === 'warmup' && r.alive && r.x !== null) {
        ctx.save();
        matrix(ctx, v.scale, v.x, v.y);
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);
        line(ctx, 2, 0, 5, 0, r.color, 0.3);
        poly(
          ctx,
          [
            [5.6, 0],
            [4.3, -0.65],
            [4.3, 0.65],
          ],
          r.color,
        );
        ctx.restore();
        ctx.fillStyle = '#eef3f5';
        ctx.font = '600 13px Barlow, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          r.name,
          v.x + (A * r.x + C * r.y) * v.scale,
          v.y + (B * r.x + D * r.y - 2) * v.scale - 6,
        );
      }
      if (!demo && r.alive && r.x !== null && Object.keys(r.effects).length) {
        const effects = Object.values(r.effects),
          step = Math.min(12, pickupRadius * 1.6);
        const px = v.x + (A * r.x + C * r.y) * v.scale,
          py = v.y + (B * r.x + D * r.y - 2.4 * bikeScale(r.radius, false)) * v.scale - step;
        effects.forEach((f, n) => {
          const i = spriteNames.indexOf(f.type);
          if (
            i < 0 ||
            !sprite.naturalWidth ||
            (f.until - Date.now() < 1000 && Math.floor(now / 100) % 2)
          )
            return;
          const sw = sprite.naturalWidth / 3,
            sh = sprite.naturalHeight / 6;
          ctx.drawImage(
            sprite,
            (i % 3) * sw,
            Math.floor(i / 3) * sh,
            sw,
            sh,
            px + (n - effects.length / 2) * step,
            py,
            step,
            step,
          );
        });
      }
      if (r.diedAt && now - r.diedAt < 650) {
        const t = (now - r.diedAt) / 650;
        ctx.save();
        matrix(ctx, v.scale, v.x, v.y);
        ctx.globalAlpha = 1 - t;
        for (let i = 0; i < 12; i++) {
          const a = (i * tau) / 12,
            rad = 1 + t * 4;
          line(
            ctx,
            r.x + Math.cos(a) * rad,
            r.y + Math.sin(a) * rad,
            r.x + Math.cos(a) * (rad + 0.75),
            r.y + Math.sin(a) * (rad + 0.75),
            r.color,
            0.27,
          );
        }
        ctx.restore();
      }
    }
  };
}

export function mountArena(canvas, getMatch, onFPS) {
  const demo = !getMatch;
  const paint = createArenaPainter(canvas, demo);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame,
    frames = 0,
    last = performance.now();
  function draw(now) {
    const scene = demo ? demoScene(reduced.matches ? 0 : now) : getMatch();
    if (!scene) return;
    paint(scene, now);
    frames++;
    if (now - last > 1000) {
      onFPS?.(Math.round((frames * 1000) / (now - last)));
      frames = 0;
      last = now;
    }
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}
