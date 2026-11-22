// Holdout IDs are outside both the training and checkpoint selection ranges.
import { presets } from '../public/catalog.js';
import { pairedMatches } from './reinforcement-matches.js';

const count = Number(process.argv[2] ?? 40);
if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
  throw new Error('Expected 1 to 10000 seed pairs per preset');
const totals = {};
for (const [index, preset] of Object.keys(presets).entries()) {
  const scores = pairedMatches(7000000 + index * 10000, count, undefined, preset);
  console.log(preset, JSON.stringify(scores));
  for (const [opponent, tally] of Object.entries(scores)) {
    totals[opponent] ??= { wins: 0, losses: 0, draws: 0, timeouts: 0 };
    for (const key of Object.keys(tally)) totals[opponent][key] += tally[key];
  }
}
console.log('All presets combined', JSON.stringify(totals));
