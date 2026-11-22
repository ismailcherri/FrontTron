// Display coordinates stay in world units until the canvas projects them.
export function makeMatch(players, size, maxScore) {
  return {
    size,
    maxScore,
    phase: 'loading',
    round: 0,
    countdownEnd: 0,
    winner: null,
    borderless: false,
    cleanageddon: false,
    spectators: 0,
    trails: [],
    pickups: {},
    racers: Object.fromEntries(
      players.map((p) => [
        p.id,
        {
          id: p.id,
          client: p.client,
          difficulty: p.difficulty,
          name: p.name,
          baseColor: p.color,
          color: p.color,
          x: null,
          y: null,
          angle: 0,
          radius: 0.6,
          printing: false,
          alive: true,
          present: true,
          loaded: Boolean(p.difficulty),
          score: 0,
          points: 0,
          effects: {},
          stroke: -1,
        },
      ]),
    ),
  };
}

function move(match, racer, x, y) {
  if (!racer) return;
  const wrapped = Math.hypot(x - racer.x, y - racer.y) > match.size / 2;
  if (racer.alive && racer.printing && racer.x !== null && !wrapped) {
    if (racer.stroke < 0) {
      racer.stroke =
        match.trails.push({
          color: racer.color,
          radius: racer.radius,
          points: [racer.x, racer.y],
        }) - 1;
    }
    match.trails[racer.stroke].points.push(x, y);
  } else {
    racer.stroke = -1;
  }
  racer.x = x;
  racer.y = y;
}

export function applyMatchEvent(match, name, data) {
  const racer = Array.isArray(data) ? match.racers[data[0]] : undefined;
  switch (name) {
    case 'round:new':
      match.size = data.size;
      match.round++;
      match.phase = 'warmup';
      match.countdownEnd = Date.now() + data.warmup;
      match.winner = null;
      match.borderless = match.cleanageddon = false;
      match.trails = [];
      match.pickups = {};
      for (const r of Object.values(match.racers))
        Object.assign(r, {
          x: null,
          y: null,
          color: r.baseColor,
          radius: 0.6,
          alive: r.present,
          effects: {},
          printing: false,
          inverse: false,
          invincible: false,
          points: 0,
          stroke: -1,
        });
      break;
    case 'position':
      move(match, racer, data[1] / 100, data[2] / 100);
      break;
    case 'angle':
      if (racer) racer.angle = data[1] / 100;
      break;
    case 'property':
      if (racer) {
        if (['printing', 'color', 'radius'].includes(data[1])) racer.stroke = -1;
        racer[data[1]] = data[2];
      }
      break;
    case 'game:start':
      match.phase = 'racing';
      break;
    case 'ready':
      if (match.racers[data]) match.racers[data].loaded = true;
      break;
    case 'round:end':
      match.phase = 'recap';
      match.winner = data;
      break;
    case 'end':
      match.phase = 'finished';
      match.winner = data;
      break;
    case 'die':
      if (racer) {
        racer.alive = false;
        racer.effects = {};
      }
      break;
    case 'score':
      if (racer) racer.score = data[1];
      break;
    case 'score:round':
      if (racer) racer.points = data[1];
      break;
    case 'game:leave':
      if (match.racers[data]) Object.assign(match.racers[data], { alive: false, present: false });
      break;
    case 'game:spectators':
      match.spectators = data;
      break;
    case 'borderless':
      match.borderless = data;
      break;
    case 'clear':
      match.trails = [];
      for (const r of Object.values(match.racers)) r.stroke = -1;
      break;
    case 'cleanageddon':
      match.cleanageddon = data !== false;
      break;
    case 'bonus:pop':
      match.pickups[data[0]] = { x: data[1] / 100, y: data[2] / 100, type: data[3] };
      break;
    case 'bonus:clear':
      delete match.pickups[data];
      break;
    case 'bonus:stack':
      if (!racer) break;
      if (data[1] === 'add')
        racer.effects[data[2]] = { type: data[3], until: Date.now() + data[4] };
      else delete racer.effects[data[2]];
      break;
  }
}
