// Positions use simulation world units. A decision describes a physical steer
// (left/straight/right); convert it to the rider's actual button at the input boundary.
export const turns = [0, -1, 1];
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

export function observe(game, avatar) {
  let shieldMs = 0;
  if (avatar.invincible) {
    const shields = Object.values(game.controller.view.racers[avatar.id].effects).filter(
      (effect) => effect.type === 'BonusSelfInvincible' || effect.type === 'BonusSelfMaster',
    );
    shieldMs = shields.length
      ? Math.max(...shields.map((effect) => effect.until)) - Date.now()
      : Infinity;
  }
  return {
    avatar,
    shieldMs,
    width: game.world.width,
    height: game.world.height,
    field: game.world.botField,
    wrap: game.borderless,
    pickups: game.bonusManager.bonuses.items.filter(p => p.body.level === avatar.body.level),
    rivals: game.avatars.items.filter(other =>
      other !== avatar && other.alive && other.present && other.body.level === avatar.body.level),
  };
}
function delta(distance, extent, wrap) {
  if (wrap && Math.abs(distance) > extent / 2) return distance - Math.sign(distance) * extent;
  return distance;
}
export function nearest(obs, x, y, items) {
  let distance = Infinity,
    dx = 0,
    dy = 0;
  for (const item of items) {
    const u = delta(item.x - x, obs.width, obs.wrap),
      v = delta(item.y - y, obs.height, obs.wrap);
    if (u * u + v * v < distance) {
      distance = u * u + v * v;
      dx = u;
      dy = v;
    }
  }
  return { distance: Math.sqrt(distance), dx, dy };
}
function wrapPosition(x, size) {
  return ((x % size) + size) % size;
}
export function edgeDistance(obs, x, y) {
  return Math.min(x, y, obs.width - x, obs.height - y);
}
function shielded(obs, elapsed) {
  return obs.avatar.invincible && elapsed < (obs.shieldMs ?? Infinity);
}
function occupied(obs, x, y, radius, serial, elapsed = 0) {
  return (
    (!obs.wrap && edgeDistance(obs, x, y) < radius) ||
    (!shielded(obs, elapsed) && obs.field.blocked(x, y, radius, obs.avatar, serial))
  );
}
export function ray(
  obs,
  angle,
  reach,
  startX = obs.avatar.x,
  startY = obs.avatar.y,
  elapsed = 0,
  serial = obs.avatar.bodyCount,
) {
  const a = obs.avatar,
    ux = Math.cos(angle),
    uy = Math.sin(angle);
  const stride = Math.max(0.35, Math.min(1, a.radius));
  for (let d = stride; d <= reach; d += stride) {
    let x = startX + ux * d,
      y = startY + uy * d;
    if (obs.wrap) {
      x = wrapPosition(x, obs.width);
      y = wrapPosition(y, obs.height);
    }
    if (occupied(obs, x, y, a.radius, serial, elapsed + (d * 1000) / a.velocity)) return d / reach;
  }
  return 1;
}
export function reactive(obs) {
  const a = obs.avatar;
  const reach = Math.max(6, a.velocity * 0.62);
  if (ray(obs, a.angle, reach) >= 0.96) return 0;
  return ray(obs, a.angle - 0.8, reach) >= ray(obs, a.angle + 0.8, reach) ? -1 : 1;
}

// Sample the turn first, then translate, in the order used by Avatar.update.
// Future gaps/spawns are unknown. Assume a currently printing trail continues.
export function rollout(obs, first, second, horizon = 1050) {
  const a = obs.avatar,
    samples = [];
  let x = a.x,
    y = a.y,
    angle = a.angle,
    safe = 0,
    prev = 0;
  let lastX = a.trail?.lastX ?? x,
    lastY = a.trail?.lastY ?? y,
    serial = a.bodyCount;
  const steps = Math.max(
    16,
    Math.min(180, Math.ceil((horizon * a.velocity) / (1000 * Math.max(0.25, a.radius)))),
  );
  const dt = horizon / steps,
    distance = (a.velocity * dt) / 1000;
  for (let i = 0; i < steps; i++) {
    const turn = i * dt < horizon * 0.48 ? first : second;
    if (a.directionInLoop) angle += turn * a.angularVelocityBase * dt;
    else if (turn && turn !== prev) angle += turn * a.angularVelocityBase;
    prev = turn;
    x += Math.cos(angle) * distance;
    y += Math.sin(angle) * distance;
    let crossed = false;
    if (obs.wrap && (x < 0 || y < 0 || x > obs.width || y > obs.height)) {
      // World.getOposite discards overshoot on one axis.
      if (x < 0) x = obs.width;
      else if (x > obs.width) x = 0;
      else if (y < 0) y = obs.height;
      else y = 0;
      crossed = true;
    }
    const elapsed = (i + 1) * dt;
    if (!crossed && occupied(obs, x, y, a.radius, serial, elapsed)) break;
    if (a.printing && (x - lastX) ** 2 + (y - lastY) ** 2 > a.radius * a.radius) {
      serial++;
      samples.push({ x, y, serial });
      lastX = x;
      lastY = y;
    }
    if (
      !shielded(obs, elapsed) &&
      samples.some(
        (p) =>
          serial - p.serial > a.trailLatency &&
          (x - p.x) ** 2 + (y - p.y) ** 2 < 4 * a.radius * a.radius,
      )
    )
      break;
    safe = (i + 1) / steps;
  }
  return { first, second, x, y, angle, safe, serial };
}
function preference(obs, path) {
  const pickup = nearest(obs, path.x, path.y, obs.pickups).distance;
  const edge = edgeDistance(obs, path.x, path.y);
  return (
    (Number.isFinite(pickup) ? 1.6 / (1 + pickup / 9) : 0) +
    (obs.wrap ? 0 : clamp(edge / 14, 0, 1) * 0.65) -
    0.16 * Math.abs(path.first) -
    0.08 * Math.abs(path.second)
  );
}

// Compare access to free cells from the candidate and from rivals' projected heads.
// This coarse grid only ranks viable trajectories. Precise trail probes decide collisions.
function territory(obs) {
  const rows = 18,
    span = obs.height / rows,
    columns = Math.round(obs.width / span),
    blocked = new Uint8Array(rows * columns),
    queue = new Int16Array(blocked.length);
  const index = (x, y) =>
    clamp(Math.floor(y / span), 0, rows - 1) * columns + clamp(Math.floor(x / span), 0, columns - 1);
  for (let i = 0; i < blocked.length; i++) {
    const x = ((i % columns) + 0.5) * span,
      y = (Math.floor(i / columns) + 0.5) * span;
    blocked[i] = Number(
      occupied(obs, x, y, Math.max(obs.avatar.radius, span * 0.54), obs.avatar.bodyCount),
    );
  }
  function flood(starts) {
    const dist = new Int16Array(blocked.length).fill(-1);
    let head = 0,
      tail = 0;
    for (const start of starts)
      if (dist[start] < 0) {
        dist[start] = 0;
        queue[tail++] = start;
      }
    while (head < tail) {
      const id = queue[head++],
        row = Math.floor(id / columns),
        col = id % columns;
      for (const [dx, dy] of neighbors) {
        let u = col + dx,
          v = row + dy;
        if (obs.wrap) {
          u = (u + columns) % columns;
          v = (v + rows) % rows;
        }
        if (u < 0 || v < 0 || u >= columns || v >= rows) continue;
        const next = v * columns + u;
        if (!blocked[next] && dist[next] < 0) {
          dist[next] = dist[id] + 1;
          queue[tail++] = next;
        }
      }
    }
    return dist;
  }
  const predicted = obs.rivals.map((r) => {
    const x = r.x + Math.cos(r.angle) * r.velocity * 0.45,
      y = r.y + Math.sin(r.angle) * r.velocity * 0.45;
    return index(
      obs.wrap ? wrapPosition(x, obs.width) : x,
      obs.wrap ? wrapPosition(y, obs.height) : y,
    );
  });
  const enemies = flood(predicted),
    cache = new Map();
  return (path) => {
    const id = index(path.x, path.y);
    if (!cache.has(id)) {
      const mine = flood([id]);
      let area = 0;
      for (let i = 0; i < mine.length; i++)
        if (mine[i] >= 0) area += enemies[i] < 0 || mine[i] < enemies[i] ? 1 : 0.15;
      cache.set(id, area / blocked.length);
    }
    return cache.get(id);
  };
}
const neighbors = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
export function plan(obs, tactical = false) {
  const space = tactical ? territory(obs) : null;
  let best = -Infinity,
    survival = -1,
    action = 0;
  for (const first of turns)
    for (const second of turns) {
      const path = rollout(obs, first, second, tactical ? 1500 : 1050);
      if (path.safe < survival) continue;
      let score = preference(obs, path);
      if (space && path.safe === 1) score += space(path) * 6;
      if (path.safe > survival || score > best) {
        survival = path.safe;
        best = score;
        action = first;
      }
    }
  return action;
}

// The same fixed-size observation is used by the trainer, opted-in demonstrations,
// and live inference. No player identity or future random state enters the model.
export function features(obs) {
  const a = obs.avatar,
    reach = Math.max(12, a.velocity * 1.7);
  const sensors = [-1.35, -0.8, -0.4, 0, 0.4, 0.8, 1.35].map((offset) =>
    ray(obs, a.angle + offset, reach),
  );
  for (const turn of [-1, 0, 1]) sensors.push(rollout(obs, turn, turn, 850).safe);
  for (const items of [obs.pickups, obs.rivals]) {
    const { distance, dx, dy } = nearest(obs, a.x, a.y, items);
    const weight = Number.isFinite(distance) ? 1 / (1 + distance / 16) : 0;
    sensors.push(
      weight * Math.cos(Math.atan2(dy, dx) - a.angle),
      weight * Math.sin(Math.atan2(dy, dx) - a.angle),
    );
  }
  sensors.push(a.radius / 2, a.velocity / 32, Number(obs.wrap), Number(a.directionInLoop));
  return sensors;
}
