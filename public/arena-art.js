import { bonuses } from './catalog.js';

const sprite = new Image();
sprite.src = '/art/bonus.png';
export const pickupArtReady = sprite.decode().catch(() => {});
const spriteNames = Object.keys(bonuses);
export function poly(c, points, color, stroke) {
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
export function line(c, x, y, xx, yy, color, width) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(xx, yy);
  c.stroke();
}
export function path(c, points) {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
}

export function pickupIcon(c, type, x, y, size) {
  const i = spriteNames.indexOf(type);
  if (!sprite.naturalWidth || i < 0) return;
  const sw = sprite.naturalWidth / 3, sh = sprite.naturalHeight / 6;
  c.drawImage(sprite, (i % 3) * sw, Math.floor(i / 3) * sh, sw, sh, x, y, size, size);
}

export function bikeBody(r, size, topDown, depthAt, paintFace) {
  const cos = Math.cos(r.angle),
    sin = Math.sin(r.angle);
  const toWorld = ([x, y, z]) => [
    r.x + size * (x * cos - y * sin),
    r.y + size * (x * sin + y * cos),
    z * size,
  ];
  const part = (points, color) => paintFace(points.map(toWorld), color);
  const walls = (outline, z, h, base, top) => {
    const roof = outline.map(([x, y]) => [x, y, z + h]);
    if (topDown) return part(roof, top);
    const sides = outline.map(([x, y], i) => {
      const [u, w] = outline[(i + 1) % outline.length];
      return [
        [x, y, z],
        [u, w, z],
        [u, w, z + h],
        [x, y, z + h],
      ];
    });
    const depth = (side) => {
      const [x, y] = toWorld(side[0]);
      const [xx, yy] = toWorld(side[1]);
      return depthAt((x + xx) / 2, (y + yy) / 2);
    };
    sides.sort((a, b) => depth(a) - depth(b));
    for (const s of sides) part(s, base);
    part(roof, top);
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
}
