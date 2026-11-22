// Episodic REINFORCE. Physics randomness and the learner's sampling are independent.
import { writeFileSync, renameSync } from 'node:fs';
import { chooseMove } from '../server/ai/drivers.js';
import {
  actionRows,
  probabilities,
  policyMove,
  featureNames,
  policySchema,
} from '../server/ai/reinforcement.js';
import { turns } from '../server/ai/steering.js';
import { playRound } from './headless-round.js';
import { pairedMatches, matchSeed } from './reinforcement-matches.js';

const batches = 64;
const batchSize = 64;
const discount = 0.985;
const learningRate = 0.15;
const trainingSeed = 10000;
const validationSeed = 1000000;
const validationPairs = 64;
const curriculum = ['hard', 'mimic', 'self', 'normal', 'self', 'hard', 'self', 'mimic'];
const zero = () => Array(featureNames.length).fill(0);
const weights = zero(),
  firstMoment = zero(),
  secondMoment = zero();
const snapshots = [weights.slice()];

function episode(batch, index) {
  const seat = index % 2;
  const pair = Math.floor(index / 2);
  const opponent = curriculum[(pair + batch) % curriculum.length];
  const seed = matchSeed(trainingSeed + (batch * batchSize) / 2 + pair);
  const frozen = snapshots[(batch + pair) % snapshots.length];
  const levels = seat === 0 ? ['reinforcement', opponent] : [opponent, 'reinforcement'];
  if (opponent === 'self') levels[1 - seat] = 'reinforcement';
  let rng = (seed ^ (seat ? 0xab79f4a1 : 0xf317adc5)) >>> 0;
  const trace = zero();
  const { winnerSeat } = playRound(seed, levels, {
    selectMove(level, obs, rider) {
      if (rider !== seat)
        return opponent === 'self' ? policyMove(obs, frozen) : chooseMove(level, obs);
      const rows = actionRows(obs),
        probs = probabilities(rows, weights);
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const sample = rng / 4294967296;
      let action = 0,
        cumulative = probs[0];
      while (action < probs.length - 1 && sample >= cumulative) cumulative += probs[++action];
      for (let j = 0; j < weights.length; j++) {
        const expected = probs.reduce((sum, p, a) => sum + p * rows[a].values[j], 0);
        trace[j] = discount * trace[j] + rows[action].values[j] - expected;
      }
      return turns[action];
    },
  });
  const reward = winnerSeat < 0 ? 0 : winnerSeat === seat ? 1 : -1;
  return trace.map((value) => value * reward);
}

function validate() {
  return pairedMatches(validationSeed, validationPairs, (level, obs) =>
    level === 'reinforcement' ? policyMove(obs, weights) : chooseMove(level, obs),
  );
}
function ranking(scores) {
  const margins = Object.values(scores).map((tally) => tally.wins - tally.losses);
  // A one-round improvement against the weaker matchup outranks any tiebreak.
  return Math.min(...margins) * (8 * validationPairs + 1) + margins.reduce((a, b) => a + b, 0);
}

const initial = validate();
let best,
  bestRank = -Infinity;
for (let batch = 0; batch < batches; batch++) {
  const gradient = zero();
  for (let i = 0; i < batchSize; i++) {
    const result = episode(batch, i);
    result.forEach((value, j) => {
      gradient[j] += value / batchSize;
    });
  }
  for (let j = 0; j < weights.length; j++) {
    firstMoment[j] = 0.9 * firstMoment[j] + 0.1 * gradient[j];
    secondMoment[j] = 0.999 * secondMoment[j] + 0.001 * gradient[j] ** 2;
    const mean = firstMoment[j] / (1 - 0.9 ** (batch + 1));
    const variance = secondMoment[j] / (1 - 0.999 ** (batch + 1));
    weights[j] += (learningRate * mean) / (Math.sqrt(variance) + 1e-8);
  }
  if ((batch + 1) % 4 === 0) snapshots.push(weights.slice());
  if ((batch + 1) % 8 === 0) {
    const scores = validate(),
      rank = ranking(scores);
    console.log('Training rounds', (batch + 1) * batchSize, 'validation', JSON.stringify(scores));
    if (rank > bestRank) {
      bestRank = rank;
      best = { batch: batch + 1, scores, weights: weights.slice() };
    }
  }
}
const model = {
  schema: policySchema,
  features: featureNames,
  weights: best.weights,
  training: {
    algorithm: 'REINFORCE',
    batches,
    batchSize,
    discount,
    learningRate,
    trainingSeed,
    curriculum,
    selectedBatch: best.batch,
    validationSeed,
    validationPairs,
    initialValidation: initial,
    selectedValidation: best.scores,
  },
};
const target = new URL('../server/ai/reinforcement-model.json', import.meta.url);
const temporary = new URL('reinforcement-model.' + process.pid + '.tmp', target);
writeFileSync(temporary, JSON.stringify(model, null, 2) + '\n');
renameSync(temporary, target);
console.log('Saved checkpoint from batch', best.batch);
