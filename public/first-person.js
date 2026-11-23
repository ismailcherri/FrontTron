import { bikeBody, line, paintViewports, pickupIcon, poly } from './arena-art.js';
import { cameraRiders } from './match.js';

const tau = Math.PI * 2;
const near = 0.24;
const trailHeight = 1.8;
const compass = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const trailCache = new WeakMap();

function camera(rider, w, h) {
  const cos = Math.cos(rider.angle), sin = Math.sin(rider.angle);
  const focal = Math.min(w * 0.72, h * 0.96), horizon = h * 0.38;
  const eye = 2.45 + rider.radius * 0.5;
  const depth = (x, y) => (x - rider.x) * cos + (y - rider.y) * sin;
  const side = (x, y) => (y - rider.y) * cos - (x - rider.x) * sin;
  const local = ([x, y, z]) => [side(x, y), depth(x, y), z];
  const screen = ([s, d, z]) => [w / 2 + focal * s / d, horizon + focal * (eye - z) / d];
  const visible = (x, y, radius) => {
    const d = depth(x, y), limit = w / (2 * focal);
    return d + radius >= near && Math.abs(side(x, y)) <= d * limit + radius * (1 + limit);
  };
  return { focal, horizon, depth, local, screen, visible };
}

// Clip in camera space before dividing by depth, including faces that straddle the rider.
function crossing(a, b) {
  const t = (near - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), near, a[2] + t * (b[2] - a[2])];
}
function face(c, v, points, color) {
  const vertices = points.map(v.local), clipped = [];
  let a = vertices.at(-1);
  for (const b of vertices) {
    if ((a[1] < near) !== (b[1] < near)) clipped.push(crossing(a, b));
    if (b[1] >= near) clipped.push(b);
    a = b;
  }
  if (clipped.length >= 3) poly(c, clipped.map(v.screen), color);
}
function edge(c, v, from, to, color, width) {
  let a = v.local(from), b = v.local(to);
  if (a[1] < near && b[1] < near) return;
  if (a[1] < near) a = crossing(a, b);
  else if (b[1] < near) b = crossing(b, a);
  line(c, ...v.screen(a), ...v.screen(b), color, width);
}

function landscape(c, v, angle, w, h) {
  const sky = c.createLinearGradient(0, 0, 0, v.horizon);
  sky.addColorStop(0, '#132237');
  sky.addColorStop(0.56, '#405368');
  sky.addColorStop(1, '#e6af82');
  c.fillStyle = sky;
  c.fillRect(0, 0, w, v.horizon + 1);

  const sunAngle = Math.atan2(Math.sin(0.3 - angle), Math.cos(0.3 - angle));
  if (Math.abs(sunAngle) < Math.atan(w / (2 * v.focal)) + 0.15) {
    const x = w / 2 + v.focal * Math.tan(sunAngle), y = v.horizon - h * 0.12;
    const radius = h * 0.031;
    const glow = c.createRadialGradient(x, y, radius, x, y, radius * 5);
    glow.addColorStop(0, '#ffce9660');
    glow.addColorStop(1, '#ffce9600');
    c.fillStyle = glow;
    c.fillRect(x - radius * 5, y - radius * 5, radius * 10, radius * 10);
    c.fillStyle = '#ffe3ad';
    c.beginPath();
    c.arc(x, y, radius, 0, tau);
    c.fill();
  }
  // Distant silhouettes are sampled around the full horizon so they stay fixed as the rider turns.
  for (const layer of [0, 1]) {
    const points = [[0, v.horizon + 1]];
    const step = tau / 160;
    const halfFov = Math.atan(w / (2 * v.focal));
    const first = Math.floor((angle - halfFov) / step), last = Math.ceil((angle + halfFov) / step);
    for (let i = first; i <= last; i++) {
      const a = i * step, b = a + layer * 2;
      const ridge = 0.035 + 0.021 * Math.cos(5 * b) + 0.012 * Math.sin(17 * b) + 0.008 * Math.cos(41 * b);
      points.push([w / 2 + v.focal * Math.tan(a - angle), v.horizon - h * (ridge + (1 - layer) * 0.028)]);
    }
    points.push([w, v.horizon + 1]);
    poly(c, points, layer ? '#354654' : '#746e72');
  }
  const ground = c.createLinearGradient(0, v.horizon, 0, h);
  ground.addColorStop(0, '#4a5a62');
  ground.addColorStop(0.22, '#2a3944');
  ground.addColorStop(1, '#15242e');
  c.fillStyle = ground;
  c.fillRect(0, v.horizon, w, h - v.horizon);
}

function track(c, v, scene) {
  const { width, height, borderless } = scene;
  const tile = height / 24;
  for (let i = 0; i * tile <= width; i++) {
    const x = i * tile;
    edge(c, v, [x, 0, 0], [x, height, 0], i % 4 ? '#566873' : '#81949a', i % 4 ? 0.8 : 1.2);
  }
  for (let i = 0; i <= 24; i++) {
    const y = i * tile;
    edge(c, v, [0, y, 0], [width, y, 0], i % 4 ? '#566873' : '#81949a', i % 4 ? 0.8 : 1.2);
  }
  for (let x = tile * 2; x < width; x += tile * 4) {
    for (let y = tile * 2; y < height; y += tile * 4) {
      if (!v.visible(x, y, 0.5)) continue;
      edge(c, v, [x - 0.36, y, 0], [x + 0.36, y, 0], '#98a8ac', 1.4);
      edge(c, v, [x, y - 0.36, 0], [x, y + 0.36, 0], '#98a8ac', 1.4);
    }
  }
  const corners = [[0, 0], [width, 0], [width, height], [0, height]];
  corners.forEach(([x, y], i) => {
    const [xx, yy] = corners[(i + 1) % 4];
    const at = (t, z) => [x + (xx - x) * t, y + (yy - y) * t, z];
    if (!borderless) {
      // Raised light standards give a sense of distance and mark the solid perimeter.
      for (let j = 0; j < 8; j++) {
        const t = (j + 0.5) / 8;
        face(c, v, [at(t - 0.004, 0.9), at(t - 0.003, 2.65),
          at(t + 0.003, 2.9), at(t + 0.004, 0.9)], '#344450');
        face(c, v, [at(t - 0.002, 2.4), at(t - 0.002, 2.57),
          at(t + 0.002, 2.73), at(t + 0.002, 2.56)], '#ffe2a5');
      }
      face(c, v, [at(0, 0), at(1, 0), at(1, 1.15), at(0, 1.15)], '#25323d');
      edge(c, v, at(0, 1.15), at(1, 1.15), '#efc27a', 1.5);
    }
    const count = Math.ceil(Math.hypot(xx - x, yy - y) / 3);
    for (let j = 0; j < count; j++) {
      const start = j / count, end = (j + 0.72) / count;
      const z = borderless ? 0.12 : 0.9;
      face(c, v, [at(start, z), at(end, z), at(end + 0.04 / count, z - 0.12),
        at(start + 0.04 / count, z - 0.12)], borderless ? '#64edce' : '#f1ba65');
    }
  });
}

// Each continuous stroke owns its mesh. Only the currently growing strokes need rebuilding.
function trailMesh(trail) {
  const { points, radius, color } = trail;
  const cached = trailCache.get(trail);
  if (cached?.length === points.length) return cached;
  const shaded = [1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * 0.62));
  const sideColor = 'rgb(' + shaded.join(',') + ')';
  const samples = [], mapPath = new Path2D();
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i], y = points[i + 1], last = samples.at(-1);
    if (last && Math.hypot(x - last[0], y - last[1]) < 0.85 && i < points.length - 2) continue;
    if (last && x === last[0] && y === last[1]) continue;
    if (last) mapPath.lineTo(x, y);
    else mapPath.moveTo(x, y);
    samples.push([x, y]);
  }
  const sections = samples.map(([x, y], i) => {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
    const scale = radius / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
    const dx = (a[1] - b[1]) * scale, dy = (b[0] - a[0]) * scale;
    return [[x + dx, y + dy], [x - dx, y - dy]];
  });
  const segments = [];
  for (let i = 1; i < samples.length; i++) {
    const [x, y] = samples[i], [px, py] = samples[i - 1];
    const [a, b] = sections[i - 1], [d, e] = sections[i];
    segments.push({
      x: (x + px) / 2, y: (y + py) / 2, radius: radius + Math.hypot(x - px, y - py) / 2,
      base: [a, b, e, d].map(([x, y]) => [x, y, 0]),
      roof: [a, b, e, d].map(([x, y]) => [x, y, trailHeight]),
      spine: [[px, py, trailHeight], [x, y, trailHeight]],
      first: i === 1, last: i === samples.length - 1, color, sideColor,
    });
  }
  const mesh = { length: points.length, segments, mapPath };
  trailCache.set(trail, mesh);
  return mesh;
}

function trailSegment(c, v, rider, s) {
  const { base, roof, color } = s;
  // Cull inward-facing sides using the rider's position in the arena plane.
  for (let i = 0; i < 4; i++) {
    if ((i === 0 && !s.first) || (i === 2 && !s.last)) continue;
    const j = (i + 1) % 4, a = base[i], b = base[j];
    if ((b[0] - a[0]) * (rider.y - a[1]) - (b[1] - a[1]) * (rider.x - a[0]) >= 0) continue;
    face(c, v, [a, b, roof[j], roof[i]], s.sideColor);
    if (color !== '#000000') edge(c, v, roof[i], roof[j], color, 1.6);
  }
  face(c, v, roof, color);
  if (color !== '#000000') edge(c, v, ...s.spine, '#ffffffa6', 1.15);
}

function traffic(c, v, rider, scene, racers, pickups) {
  const visible = [];
  for (const trail of scene.trails) {
    for (const segment of trailMesh(trail).segments) {
      if (v.visible(segment.x, segment.y, segment.radius))
        visible.push({ depth: v.depth(segment.x, segment.y), segment });
    }
  }
  for (const p of pickups) {
    const depth = v.depth(p.x, p.y);
    if (depth >= near && v.visible(p.x, p.y, 1.2)) visible.push({ depth, pickup: p });
  }
  for (const r of racers) {
    if (r !== rider && r.alive && r.x !== null && v.visible(r.x, r.y, r.radius * 3))
      visible.push({ depth: v.depth(r.x, r.y), bike: r });
  }
  visible.sort((a, b) => b.depth - a.depth);
  for (const item of visible) {
    if (item.segment) trailSegment(c, v, rider, item.segment);
    else if (item.pickup) {
      const p = item.pickup, [x, y] = v.screen(v.local([p.x, p.y, 0.16]));
      const size = 2.4 * v.focal / item.depth;
      pickupIcon(c, p.type, x - size / 2, y - size, size);
    } else {
      const r = item.bike;
      bikeBody(r, r.radius * 1.2, false, (x, y) => -v.depth(x, y),
        (points, color) => face(c, v, points, color));
      if (r.invincible) {
        const ring = Array.from({ length: 24 }, (_, i) => [
          r.x + Math.cos(i * tau / 24) * r.radius * 3.3,
          r.y + Math.sin(i * tau / 24) * r.radius * 3.3, 0.08,
        ]);
        ring.forEach((p, i) => edge(c, v, p, ring[(i + 1) % ring.length], '#eefbff', 1.5));
      }
    }
  }
}

function cockpit(c, rider, w, h) {
  const scale = Math.min(w / 660, h / 350);
  c.save();
  c.translate(w / 2, h);
  c.scale(scale, scale);
  const metal = c.createLinearGradient(0, -65, 0, 0);
  metal.addColorStop(0, '#6e828d');
  metal.addColorStop(0.2, '#354653');
  metal.addColorStop(0.68, '#1b2732');
  metal.addColorStop(1, '#101922');
  const glass = c.createLinearGradient(0, -70, 0, -20);
  glass.addColorStop(0, '#a6dbdb1c');
  glass.addColorStop(1, '#182d3d78');
  const windscreen = [[-85, -27], [-103, -63], [-68, -74], [68, -74], [103, -63], [85, -27]];
  poly(c, windscreen, glass);
  c.strokeStyle = '#aad3d454';
  c.lineWidth = 1.25;
  c.stroke();
  for (const mirror of [-1, 1]) {
    c.save();
    c.scale(mirror, 1);
    poly(c, [[38, 2], [68, -23], [141, -27], [184, -53], [210, -51], [221, -39], [159, 1]], '#111b24');
    poly(c, [[67, -18], [89, -31], [139, -33], [166, -48], [180, -44], [149, -23]], metal);
    poly(c, [[151, -36], [192, -64], [214, -59], [220, -48], [178, -23], [160, -24]], '#17212a');
    for (let j = 0; j < 5; j++)
      line(c, 166 + j * 7, -37 - j * 4.4, 174 + j * 7, -28 - j * 4.4, '#46535c', 2);
    poly(c, [[110, 1], [149, -19], [199, -34], [230, -56], [255, -54], [218, -17], [191, 1]], metal);
    poly(c, [[152, -13], [204, -29], [233, -49], [244, -49], [208, -24]], rider.color);
    poly(c, [[51, 0], [73, -29], [127, -18], [157, 0]], '#22303a');
    line(c, 76, -26, 126, -16, '#607480', 1.2);
    for (let j = 0; j < 3; j++)
      line(c, 88 + j * 7, -17 + j, 80 + j * 7, -6 + j, '#101a23', 3);
    c.restore();
  }
  poly(c, [[-103, 2], [-77, -30], [-45, -44], [45, -44], [77, -30], [103, 2]], metal);
  poly(c, [[-56, -29], [-39, -38], [39, -38], [56, -29], [46, -8], [-46, -8]], '#0c171e');
  line(c, -33, -35, 33, -35, rider.invincible ? '#ffffff' : rider.color, 1.5);
  const bearing = (Math.round(90 + rider.angle * 360 / tau) % 360 + 360) % 360;
  const direction = compass[(Math.round(rider.angle * 8 / tau) % 8 + 8) % 8];
  c.font = Math.min(17, Math.max(13, 10 / scale)) + 'px "Space Mono", monospace';
  c.textAlign = 'center';
  c.fillStyle = '#e0f2ee';
  c.fillText(direction + ' ' + String(bearing).padStart(3, '0') + '°', 0, -16);
  c.restore();
}

function minimap(c, scene, rider, racers, pickups, w, h, caption) {
  const size = Math.min(w * 0.24, h * 0.29, 148);
  const scale = size / Math.max(scene.width, scene.height);
  const mw = scene.width * scale, mh = scene.height * scale;
  const pad = Math.min(10, size * 0.085);
  const x = w - mw - pad * 2, y = pad * 2;
  c.save();
  c.translate(x, y);
  c.fillStyle = '#0d171fef';
  c.fillRect(-pad / 2, -pad / 2, mw + pad, mh + pad + (caption ? 17 : 0));
  c.strokeStyle = scene.borderless ? '#64edce' : '#a6a084';
  c.lineWidth = 1;
  c.strokeRect(0, 0, mw, mh);
  c.save();
  c.beginPath();
  c.rect(0, 0, mw, mh);
  c.clip();
  for (let n = 1; n < 4; n++) {
    line(c, mw * n / 4, 0, mw * n / 4, mh, '#293b46', 1);
    line(c, 0, mh * n / 4, mw, mh * n / 4, '#293b46', 1);
  }
  c.save();
  c.scale(scale, scale);
  c.lineCap = c.lineJoin = 'round';
  for (const t of scene.trails) {
    c.strokeStyle = t.color;
    c.lineWidth = Math.max(1 / scale, t.radius * 2);
    c.stroke(trailMesh(t).mapPath);
  }
  c.restore();
  for (const p of pickups) {
    const px = p.x * scale, py = p.y * scale, r = Math.max(1.5, size * 0.017);
    poly(c, [[px, py - r], [px + r, py], [px, py + r], [px - r, py]], '#eff9e6');
  }
  for (const r of racers) {
    if (r === rider || !r.alive || r.x === null) continue;
    c.fillStyle = r.color;
    c.beginPath();
    c.arc(r.x * scale, r.y * scale, Math.max(2, size * 0.02), 0, tau);
    c.fill();
  }
  c.restore();
  c.save();
  c.translate(rider.x * scale, rider.y * scale);
  c.rotate(rider.angle);
  const r = Math.max(4.5, size * 0.047);
  poly(c, [[r, 0], [-r * 0.7, -r * 0.68], [-r * 0.4, 0], [-r * 0.7, r * 0.68]], rider.color);
  c.lineWidth = 1.4;
  c.strokeStyle = '#fff';
  c.stroke();
  c.restore();
  if (caption) {
    c.fillStyle = '#e0e9ec';
    c.font = '600 12px Barlow, sans-serif';
    c.textAlign = 'left';
    c.fillText(caption, 0, mh + 13, mw);
  }
  c.restore();
}

export function paintFirstPerson(c, scene, w, h, clientId) {
  const racers = Object.values(scene.racers), pickups = Object.values(scene.pickups);
  const riders = cameraRiders(racers, clientId);
  c.fillStyle = '#121c25';
  c.fillRect(0, 0, w, h);
  if (!riders.length) return;
  paintViewports(c, riders, w, h, (rider, vw, vh) => {
    const v = camera(rider, vw, vh);
    landscape(c, v, rider.angle, vw, vh);
    track(c, v, scene);
    traffic(c, v, rider, scene, racers, pickups);
    cockpit(c, rider, vw, vh);
    const caption = rider.client !== clientId ? 'Following ' + rider.name : (riders.length > 1 ? rider.name : '');
    minimap(c, scene, rider, racers, pickups, vw, vh, caption);
  });
}
