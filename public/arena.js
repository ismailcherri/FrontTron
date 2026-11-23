import { bikeBody, line, paintViewports, path, pickupIcon, poly } from './arena-art.js';
import { paintFirstPerson } from './first-person.js';
import { platformViews } from './match.js';
export { pickupArtReady } from './arena-art.js';

const A = 0.89,
  B = 0.42,
  C = -0.75,
  D = 0.5;
const tau = Math.PI * 2;
const lipRatio = 0.045;
const baseDepthRatio = lipRatio * 1.4;
function matrix(c, v) {
  c.transform(v.a, v.b, v.c, v.d, v.x, v.y);
}
function project(v, x, y, z = 0) {
  return [v.x + v.a * x + v.c * y, v.y + v.b * x + v.d * y - v.lift * z];
}
function camera(w, h, arenaWidth, arenaHeight, demo, topDown, stackHeight) {
  const pad = demo ? 0 : Math.max(6, Math.min(w, h) * 0.012);
  if (topDown) {
    const scale = Math.min(Math.max(1, w - 2 * pad) / arenaWidth, Math.max(1, h - 2 * pad) / arenaHeight);
    return {
      topDown, scale, a: scale, b: 0, c: 0, d: scale, lift: 0,
      x: (w - arenaWidth * scale) / 2, y: (h - arenaHeight * scale) / 2,
    };
  }
  // Frame the full deck, including its base and the raised pickups at the back edge.
  const width = demo ? arenaWidth * 1.82 : A * arenaWidth - C * arenaHeight + 4;
  const headroom = 5.4 + stackHeight;
  const floorHeight = B * arenaWidth + D * arenaHeight;
  const height = demo ? arenaHeight * 1.13 : floorHeight + arenaHeight * baseDepthRatio + headroom;
  const scale = Math.min((w - 2 * pad) / width, (h - 2 * pad) / height);
  return {
    topDown,
    scale,
    a: A * scale, b: B * scale, c: C * scale, d: D * scale, lift: scale,
    x: (w - (A * arenaWidth + C * arenaHeight) * scale) / 2,
    y: demo
      ? (h - floorHeight * scale) / 2 - 2 * scale
      : (h - height * scale) / 2 + headroom * scale,
  };
}
// Upper floors share the active floor's footprint. Only their translucent edges
// and surfaces are visible, so they cannot obscure hazards on the riding surface.
function overheadDeck(c, v, width, height, elevation, distance) {
  c.save();
  c.translate(0, -elevation);
  matrix(c, v);
  c.fillStyle = distance === 1 ? '#a6d6ea09' : '#a6d6ea05';
  c.fillRect(0, 0, width, height);
  c.lineWidth = Math.max(1 / v.scale, 0.22);
  c.strokeStyle = distance === 1 ? '#a6d6ea55' : '#a6d6ea33';
  c.strokeRect(0, 0, width, height);
  c.restore();
}

function floorCaption(c, focus, count, split, clientId, w) {
  const {level, riders} = focus;
  const followed = riders[0];
  const caption = followed && (clientId == null || followed.client !== clientId) ? 'Following ' + followed.name :
    split ? riders.map(r => r.name).join(' · ') : '';
  c.save();
  c.textAlign = 'left';
  c.textBaseline = 'top';
  c.fillStyle = '#ffc968';
  c.font = '700 15px "Barlow Condensed", sans-serif';
  c.fillText('LEVEL ' + (level + 1) + ' / ' + count, 12, 10);
  if (caption) {
    c.fillStyle = '#d4dfe4';
    c.font = '600 12px Barlow, sans-serif';
    c.fillText(caption, 12, 28, Math.max(1, w - 24));
  }
  c.restore();
}

const liftColors = ['#66efdb', '#c7a1ff'];
// A shaft and a translucent landing ring mark the lift directly overhead.
function liftShaft(c, v, link, rise) {
  const [x, y] = project(v, link.x, link.y);
  c.save();
  c.strokeStyle = liftColors[link.lower];
  c.globalAlpha = 0.55;
  c.lineWidth = 1.25;
  c.setLineDash([2, 4]);
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - rise);
  c.stroke();
  c.setLineDash([]);
  c.translate(0, -rise);
  matrix(c, v);
  c.lineWidth = 0.3;
  c.beginPath();
  c.arc(link.x, link.y, link.radius, 0, tau);
  c.stroke();
  c.restore();
}
function liftPad(c, v, link, level, now) {
  const { x, y, radius, lower } = link;
  const up = level === lower;
  const color = liftColors[lower];
  c.save();
  matrix(c, v);
  c.translate(x, y);
  c.beginPath();
  c.arc(0, 0, radius, 0, tau);
  c.fillStyle = '#13252e';
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 0.6;
  c.stroke();
  c.globalAlpha = 0.45 + 0.2 * Math.sin(now / 320);
  c.beginPath();
  c.arc(0, 0, radius * 1.22, 0, tau);
  c.lineWidth = 0.25;
  c.stroke();
  c.restore();
  const [px, py] = project(v, x, y);
  c.save();
  c.font = '700 ' + Math.max(10, Math.min(17, radius * v.scale)) + 'px Barlow, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.strokeStyle = '#13252e';
  c.lineWidth = 2.5;
  c.fillStyle = color;
  const label = up ? '↑' + (level + 2) : '↓' + level;
  c.strokeText(label, px, py);
  c.fillText(label, px, py);
  c.restore();
}
function face(c, view, points, color) {
  poly(c, points.map(([x, y, z]) => project(view, x, y, z)), color);
}
function deckBase(c, v, width, height) {
  const lip = height * lipRatio;
  const sides = (top, bottom, left, right) => {
    face(
      c,
      v,
      [
        [0, height, top],
        [width, height, top],
        [width, height, bottom],
        [0, height, bottom],
      ],
      left,
    );
    face(
      c,
      v,
      [
        [width, height, top],
        [width, 0, top],
        [width, 0, bottom],
        [width, height, bottom],
      ],
      right,
    );
  };
  sides(-lip * 0.7, -height * baseDepthRatio, '#111722', '#19212c');
  sides(-lip * 0.55, -lip * 0.7, '#896b38', '#735126');
  sides(0, -lip * 0.55, '#36414c', '#232b35');
  for (let i = 1; i < 32; i++) {
    const x = (width * i) / 32,
      y = (height * i) / 32,
      bright = i % 6 === 0;
    face(
      c,
      v,
      [
        [x, height, -lip * 0.12],
        [x + height * 0.015, height, -lip * 0.12],
        [x + height * 0.012, height, -lip * 0.41],
        [x - height * 0.003, height, -lip * 0.41],
      ],
      bright ? '#efb343' : '#131a23',
    );
    face(
      c,
      v,
      [
        [width, y, -lip * 0.12],
        [width, y + height * 0.012, -lip * 0.12],
        [width, y + height * 0.015, -lip * 0.41],
        [width, y + height * 0.003, -lip * 0.41],
      ],
      bright ? '#d6a146' : '#111820',
    );
  }
}
function deck(c, v, width, height, borderless) {
  if (!v.topDown) deckBase(c, v, width, height);
  c.save();
  matrix(c, v);
  const grad = c.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#32414b');
  grad.addColorStop(0.5, '#28343e');
  grad.addColorStop(1, '#192630');
  c.fillStyle = grad;
  c.fillRect(0, 0, width, height);
  const rows = 24, tile = height / rows, columns = width / tile;
  for (let i = 0; i <= columns; i++) {
    const a = i * tile,
      strong = i % 4 === 0;
    const color = strong ? '#50606a' : '#3b4954';
    line(c, a, 0, a, height, color, strong ? 0.14 : 0.08);
    if (i <= rows) line(c, 0, a, width, a, color, strong ? 0.14 : 0.08);
  }
  for (let i = 2; i < columns; i += 4)
    for (let j = 2; j < rows; j += 4) {
      const x = i * tile,
        y = j * tile;
      line(c, x - 0.45, y, x + 0.45, y, '#71828d', 0.12);
      line(c, x, y - 0.45, x, y + 0.45, '#71828d', 0.12);
    }
  c.strokeStyle = borderless ? '#64edce' : '#8b8f84';
  c.lineWidth = 0.43;
  c.setLineDash(borderless ? [1, 1] : []);
  c.strokeRect(0, 0, width, height);
  c.setLineDash([]);
  c.strokeStyle = '#50606a';
  c.lineWidth = 0.13;
  c.strokeRect(0.9, 0.9, width - 1.8, height - 1.8);
  for (const [x, y, ang] of [
    [0, 0, 0],
    [width, 0, Math.PI / 2],
    [width, height, Math.PI],
    [0, height, -Math.PI / 2],
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
function trails(c, list, v, preview, level) {
  c.save();
  matrix(c, v);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const t of list) {
    if ((t.level ?? 0) !== level || t.points.length < 4) continue;
    path(c, t.points);
    c.strokeStyle = t.color;
    c.globalAlpha = 0.12;
    c.lineWidth = t.radius * 5;
    c.stroke();
    c.globalAlpha = 1;
    c.lineWidth = t.radius * 2;
    c.stroke();
    c.save();
    if (!v.topDown) {
      const height = preview ? 1.85 : 0.64;
      const dx = (height * C) / (A * D - B * C),
        dy = (-height * A) / (A * D - B * C);
      // A vertical ribbon joins the footprint to the illuminated top edge.
      path(c, t.points);
      for (let i = t.points.length - 2; i >= 0; i -= 2)
        c.lineTo(t.points[i] + dx, t.points[i + 1] + dy);
      c.closePath();
      c.fillStyle = t.color;
      c.globalAlpha = 0.7;
      c.fill();
      c.globalAlpha = 1;
      c.translate(dx, dy);
    }
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
  bikeBody(r, size, v.topDown, (x, y) => B * x + D * y, (points, color) => face(c, v, points, color));
  if (r.invincible) {
    c.save();
    matrix(c, v);
    c.strokeStyle = '#f7f9f5';
    c.lineWidth = 0.15;
    c.beginPath();
    c.arc(r.x, r.y, 2.8 * size, 0, tau);
    c.stroke();
    c.restore();
  }
}
function pickup(c, p, v, rad) {
  const [x, y] = project(v, p.x, p.y);
  if (!v.topDown) {
    c.fillStyle = '#07151ca6';
    c.beginPath();
    c.ellipse(x, y, rad * 0.88, rad * 0.38, 0, 0, tau);
    c.fill();
  }
  pickupIcon(c, p.type, x - rad, y - rad * (v.topDown ? 1 : 1.8), rad * 2);
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

function drawRacer(ctx, r, v, demo, phase, pickupRadius, now) {
  bike(ctx, r, v, demo);
  if (!demo && phase === 'warmup' && r.alive && r.x !== null) {
    ctx.save();
    matrix(ctx, v);
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
    const [x, y] = project(v, r.x, r.y);
    ctx.fillText(r.name, x, y - 2 * v.scale - 6);
  }
  if (!demo && r.alive && r.x !== null && Object.keys(r.effects).length) {
    const effects = Object.values(r.effects),
      step = Math.min(12, pickupRadius * 1.6);
    const [px, y] = project(v, r.x, r.y);
    const py = y - 2.4 * bikeScale(r.radius, false) * v.scale - step;
    effects.forEach((f, n) => {
      if (f.until - Date.now() < 1000 && Math.floor(now / 100) % 2) return;
      pickupIcon(ctx, f.type, px + (n - effects.length / 2) * step, py, step);
    });
  }
  if (r.diedAt && now - r.diedAt < 650) {
    const t = (now - r.diedAt) / 650;
    ctx.save();
    matrix(ctx, v);
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

// The match, lobby preview, and field guide share the same camera and arena artwork.
export function createArenaPainter(canvas, demo = false, clientId = null) {
  const ctx = canvas.getContext('2d');
  const backdrops = [];
  return (scene, now) => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const pixelsWide = Math.round(w * dpr), pixelsHigh = Math.round(h * dpr);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (scene.arenaView === 'first-person') {
      paintFirstPerson(ctx, scene, w, h, clientId);
      return;
    }
    const topDown = scene.arenaView === 'top-down';
    const width = scene.width ?? scene.size, height = scene.height ?? scene.size;
    const count = scene.levelCount ?? 1;
    const racers = Object.values(scene.racers);
    const focuses = count > 1 ? platformViews(racers, clientId) : [{level: 0, riders: []}];
    if (!topDown) racers.sort((a, b) => (a.x - b.x) * B + (a.y - b.y) * D);
    const pickups = Object.values(scene.pickups);
    const spacing = height * 0.14;
    ctx.clearRect(0, 0, w, h);
    backdrops.length = focuses.length;
    paintViewports(ctx, focuses, w, h, (focus, vw, vh, index) => {
      const {level} = focus;
      const key = [vw, vh, dpr, width, height, scene.borderless, topDown, count, level].join(',');
      if (backdrops[index]?.key !== key) {
        const v = camera(vw, vh, width, height, demo, topDown, spacing * (count - 1));
        const rise = spacing * v.lift;
        v.y -= level * rise;
        const surface = document.createElement('canvas');
        surface.width = Math.max(1, Math.round(vw * dpr));
        surface.height = Math.max(1, Math.round(vh * dpr));
        const dc = surface.getContext('2d');
        dc.scale(surface.width / vw, surface.height / vh);
        deck(dc, v, width, height, scene.borderless);
        for (let upper = level + 1; upper < count; upper++) {
          const distance = upper - level;
          overheadDeck(dc, v, width, height, distance * rise, distance);
        }
        backdrops[index] = {key, v, rise, surface};
      }
      const {v, rise, surface} = backdrops[index];
      ctx.drawImage(surface, 0, 0, vw, vh);
      for (const link of scene.links ?? []) {
        if (link.lower === level) liftShaft(ctx, v, link, rise);
        if (link.lower === level || link.lower + 1 === level) liftPad(ctx, v, link, level, now);
      }
      trails(ctx, scene.trails, v, demo, level);
      const pickupRadius = (demo ? 3 : 1.2) * v.scale;
      for (const p of pickups) {
        if ((p.level ?? 0) === level) pickup(ctx, p, v, pickupRadius);
      }
      for (const r of racers) {
        if ((r.level ?? 0) === level) drawRacer(ctx, r, v, demo, scene.phase, pickupRadius, now);
      }
      if (count > 1) floorCaption(ctx, focus, count, focuses.length > 1, clientId, vw);
    });
  };
}

export function mountArena(canvas, getMatch, onFPS, clientId) {
  const demo = !getMatch;
  const paint = createArenaPainter(canvas, demo, clientId);
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
