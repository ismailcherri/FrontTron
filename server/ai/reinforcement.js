// An action-conditioned softmax policy. The same features feed training and serving.
// Three possible continuations estimate whether each first steer leaves an escape.
import { edgeDistance, nearest, ray, rollout, turns } from './steering.js';

export const policySchema = 'fronttron-reinforce-v1';
export const featureNames = [
  'straight',
  'escapeOptions',
  'holdCourse',
  'straighten',
  'exitAhead',
  'exitFan',
  'wallSpace',
  'pickupAccess',
  'rivalDistance',
  'rivalIntercept',
];

export function actionRows(obs) {
  const horizon = 1750;
  const projected = obs.rivals.map((r) => ({
    x: r.x + Math.cos(r.angle) * r.velocity * 0.65,
    y: r.y + Math.sin(r.angle) * r.velocity * 0.65,
  }));
  const rows = turns.map((turn) => {
    const paths = turns.map((next) => rollout(obs, turn, next, horizon));
    const safe = Math.max(...paths.map((p) => p.safe));
    const row = [
      Number(turn === 0),
      paths.reduce((n, p) => n + p.safe, 0) / 3,
      paths[turns.indexOf(turn)].safe,
      paths[0].safe,
      0,
      0,
      0,
      0,
      0,
      0,
    ];
    const reachable = paths.filter((p) => p.safe === safe);
    for (const p of reachable) {
      // Probe open space beyond the end of this maneuver before committing to it.
      const reach = Math.max(8, obs.avatar.velocity * 0.8);
      const ahead = ray(obs, p.angle, reach, p.x, p.y, p.safe * horizon, p.serial);
      const left = ray(obs, p.angle - 0.75, reach, p.x, p.y, p.safe * horizon, p.serial);
      const right = ray(obs, p.angle + 0.75, reach, p.x, p.y, p.safe * horizon, p.serial);
      const edge = edgeDistance(obs, p.x, p.y);
      const near = nearest(obs, p.x, p.y, obs.rivals).distance;
      const intercept = nearest(obs, p.x, p.y, projected).distance;
      const pickup = nearest(obs, p.x, p.y, obs.pickups).distance;
      row[4] += ahead;
      row[5] += (ahead + left + right) / 3;
      row[6] += obs.wrap ? 1 : Math.min(1, Math.max(0, edge) / 16);
      row[7] += 1 / (1 + pickup / 12);
      row[8] += 1 / (1 + near / 16);
      row[9] += 1 / (1 + intercept / 8);
    }
    for (let i = 4; i < row.length; i++) row[i] /= reachable.length;
    return { survival: safe, values: row };
  });
  return rows;
}

export function probabilities(rows, weights) {
  // Avoid routes predicted to crash when another input survives the horizon.
  // The learned policy chooses among the viable first inputs at each decision.
  const viable = Math.max(...rows.map((row) => row.survival));
  const logits = rows.map((row) =>
    row.survival < viable
      ? -Infinity
      : row.values.reduce((sum, value, i) => sum + value * weights[i], 0),
  );
  const peak = Math.max(...logits);
  const values = logits.map((value) => Math.exp(value - peak));
  const total = values.reduce((a, b) => a + b);
  return values.map((value) => value / total);
}

export function policyMove(obs, weights) {
  const probs = probabilities(actionRows(obs), weights);
  return turns[probs.indexOf(Math.max(...probs))];
}

export function loadWeights(model) {
  if (
    model?.schema !== policySchema ||
    !Array.isArray(model.features) ||
    model.features.length !== featureNames.length ||
    !featureNames.every((name, i) => name === model.features[i]) ||
    !Array.isArray(model.weights) ||
    model.weights.length !== featureNames.length ||
    !model.weights.every(Number.isFinite)
  )
    throw new Error('Invalid FrontTron reinforcement policy');
  return model.weights;
}
