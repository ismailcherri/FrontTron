import { playRound } from './headless-round.js';

export const opponents = ['hard', 'mimic'];

// A bijective 32-bit mix spreads adjacent experiment IDs across the environment RNG.
export function matchSeed(id) {
  let n = Math.imul(id ^ (id >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return (n ^ (n >>> 16)) >>> 0;
}

// Reuse each spawn and pickup RNG seed with seats reversed for each opponent.
export function pairedMatches(seedBase, count, selectMove, preset) {
  const scores = {};
  for (const opponent of opponents) {
    const tally = { wins: 0, losses: 0, draws: 0, timeouts: 0 };
    for (let i = 0; i < count; i++) {
      for (const seat of [0, 1]) {
        const levels = seat === 0 ? ['reinforcement', opponent] : [opponent, 'reinforcement'];
        const { winnerSeat, timeout } = playRound(matchSeed(seedBase + i), levels, {
          selectMove,
          preset,
        });
        if (timeout) tally.timeouts++;
        else if (winnerSeat < 0) tally.draws++;
        else if (winnerSeat === seat) tally.wins++;
        else tally.losses++;
      }
    }
    scores[opponent] = tally;
  }
  return scores;
}
