// Offline behavior cloning. Each target is a demonstrated steering decision.
// No rewards, live model updates, dependencies or network calls.
import { readFileSync, writeFileSync } from 'node:fs';
import { TrailField } from '../server/ai/field.js';
import { plan, features, rollout } from '../server/ai/steering.js';
import { classify, schema } from '../server/ai/imitation.js';

let seed = 73991;
const random = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
function episode() {
  const size = 80 + Math.floor(random() * 30),
    field = new TrailField(size);
  const avatar = {
    x: 8 + random() * (size - 16),
    y: 8 + random() * (size - 16),
    angle: random() * Math.PI * 2,
    alive: true,
    velocity: 12 + random() * 12,
    radius: 0.45 + random() * 0.65,
    bodyCount: 5,
    trailLatency: 3,
    directionInLoop: random() > 0.08,
    angularVelocityBase: 0.0028,
    printing: true,
  };
  if (!avatar.directionInLoop) avatar.angularVelocityBase = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    let x = random() * size,
      y = random() * size,
      angle = random() * Math.PI * 2;
    const bend = (random() - 0.5) * 0.08;
    for (let j = 0; j < 35; j++) {
      if (j < 13 || j > 19) field.add({ x, y, radius: 0.6, data: null, num: 0 });
      angle += bend;
      x += Math.cos(angle) * 0.85;
      y += Math.sin(angle) * 0.85;
    }
  }
  const spot = () => ({ x: random() * size, y: random() * size });
  return {
    width: size,
    height: size,
    field,
    avatar,
    wrap: random() < 0.15,
    pickups: [spot(), spot()],
    rivals: [{ ...spot(), velocity: 16, angle: random() * 6.28 }],
  };
}
function demonstrations(count, learner) {
  const examples = [];
  for (let i = 0; i < count; i++) {
    const obs = episode(),
      a = obs.avatar;
    for (let tick = 0; tick < 18; tick++) {
      const inputs = features(obs),
        action = plan(obs, true);
      examples.push([inputs, action]);
      const drive = learner && random() < 0.7 ? classify(learner, inputs) : action;
      const p = rollout(obs, drive, drive, 160);
      if (p.safe < 1) break;
      a.x = p.x;
      a.y = p.y;
      a.angle = p.angle;
      obs.field.add({ x: a.x, y: a.y, radius: a.radius, data: a, num: a.bodyCount++ });
    }
  }
  return examples;
}
function fit(rows) {
  const trees = [];
  for (let t = 0; t < 7; t++) {
    const bag = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]);
    function split(group, depth) {
      const counts = [0, 0, 0];
      for (const [, label] of group) counts[label + 1]++;
      const winner = counts.indexOf(Math.max(...counts)) - 1;
      if (depth === 9 || group.length < 28 || Math.max(...counts) === group.length) return winner;
      let best = Infinity,
        choice;
      // Randomized CART splits with weighted Gini impurity.
      for (let k = 0; k < 85; k++) {
        const dim = Math.floor(random() * group[0][0].length);
        const cut = group[Math.floor(random() * group.length)][0][dim];
        const left = [0, 0, 0],
          right = [...counts];
        let n = 0;
        for (const [x, y] of group)
          if (x[dim] <= cut) {
            left[y + 1]++;
            right[y + 1]--;
            n++;
          }
        if (n < 7 || group.length - n < 7) continue;
        const impurity =
          group.length -
          left.reduce((s, v) => s + v * v, 0) / n -
          right.reduce((s, v) => s + v * v, 0) / (group.length - n);
        if (impurity < best) {
          best = impurity;
          choice = [dim, cut];
        }
      }
      if (!choice) return winner;
      const [dim, cut] = choice,
        left = [],
        right = [];
      for (const row of group) (row[0][dim] <= cut ? left : right).push(row);
      return [dim, Number(cut.toFixed(6)), split(left, depth + 1), split(right, depth + 1)];
    }
    trees.push(split(bag, 0));
  }
  return trees;
}
const extra = process.argv.slice(2).flatMap((path) => {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (
    data.schema !== schema ||
    !Array.isArray(data.examples) ||
    !data.examples.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 2 &&
        Array.isArray(row[0]) &&
        row[0].length === 18 &&
        row[0].every(Number.isFinite) &&
        [-1, 0, 1].includes(row[1]),
    )
  )
    throw Error('Invalid steering demonstrations: ' + path);
  return data.examples;
});
const training = demonstrations(420);
const pilot = fit(training);
const labeled = training.concat(demonstrations(120, pilot), extra);
const trees = fit(labeled);
const holdout = demonstrations(90);
const hits = [0, 0, 0],
  counts = [0, 0, 0];
for (const [inputs, label] of holdout) {
  counts[label + 1]++;
  if (classify(trees, inputs) === label) hits[label + 1]++;
}
const metrics = {
  trainingExamples: labeled.length,
  humanExamples: extra.length,
  heldOutExamples: holdout.length,
  agreement: hits.reduce((a, b) => a + b) / holdout.length,
  majorityBaseline: Math.max(...counts) / holdout.length,
  recall: hits.map((n, i) => n / counts[i]),
};
writeFileSync(
  new URL('../server/ai/model.json', import.meta.url),
  JSON.stringify({ schema, version: 1, metrics, trees }) + '\n',
);
console.log(metrics);
