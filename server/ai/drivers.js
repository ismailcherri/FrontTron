import { readFileSync } from 'node:fs';
import { TrailField } from './field.js';
import { features, observe, plan, reactive } from './steering.js';
import { loadWeights, policyMove } from './reinforcement.js';
import { classify, schema } from './imitation.js';

const model = JSON.parse(readFileSync(new URL('./model.json', import.meta.url), 'utf8'));
if (model.schema !== schema) throw new Error('Unsupported bot model');
let reinforcementWeights;
const intervals = { easy: 285, normal: 140, hard: 145, mimic: 135, reinforcement: 140 };
export function chooseMove(level, obs) {
  if (level === 'easy') return reactive(obs);
  if (level === 'normal') return plan(obs);
  if (level === 'hard') return plan(obs, true);
  if (level === 'reinforcement') {
    // Training can start from zero even when the deployment artifact has yet to be built.
    reinforcementWeights ??= loadWeights(
      JSON.parse(readFileSync(new URL('./reinforcement-model.json', import.meta.url), 'utf8')),
    );
    return policyMove(obs, reinforcementWeights);
  }
  const inputs = features(obs),
    predicted = classify(model.trees, inputs);
  // Let the model drive. Override a demonstration only for an imminent collision
  // when another steering input buys appreciably more time.
  const safety = inputs.slice(7, 10),
    longest = Math.max(...safety);
  if (safety[predicted + 1] < 0.38 && longest > safety[predicted + 1] + 0.2)
    return safety.indexOf(longest) - 1;
  return predicted;
}
export class Drivers {
  constructor(game) {
    this.game = game;
    this.selectMove = chooseMove;
    this.riders = game.avatars.items.filter(
      (a) =>
        a.player.difficulty ||
        (a.player.client?.recordDriving && a.player.client.players.getFirst() === a.player),
    );
    this.clock = 0;
  }
  reset() {
    if (this.riders.length) this.game.world.botField = new TrailField(this.game.world.width);
    this.riders.forEach((a, i) => {
      a.nextDecision = this.clock + 20 * i;
      a.humanInput = 0;
    });
  }
  tick(step) {
    if (!this.riders.length || !this.game.inRound) return;
    this.clock += step;
    // One policy per simulation step per room. Earliest deadline wins.
    let rider;
    for (const a of this.riders)
      if (
        a.present &&
        a.alive &&
        a.nextDecision <= this.clock &&
        (!rider || a.nextDecision < rider.nextDecision)
      )
        rider = a;
    if (!rider) return;
    const budget = this.game.room.botBudget;
    const started = performance.now();
    if (budget && !budget.available(started)) return;
    const level = rider.player.difficulty;
    rider.nextDecision = this.clock + (intervals[level] || 160);
    const obs = observe(this.game, rider);
    if (level) {
      const physical = this.selectMove(level, obs),
        input = rider.inverse ? -physical : physical;
      // A quarter-turn power-up consumes a press immediately. Releasing between
      // decisions lets another physical press issue a second quarter turn.
      if (!rider.directionInLoop) rider.updateAngularVelocity(0);
      rider.updateAngularVelocity(input);
    } else if (rider.player.client.recordDriving) {
      rider.player.client.addEvent('driving:sample', [
        features(obs),
        rider.humanInput * (rider.inverse ? -1 : 1),
      ]);
    }
    if (budget) budget.used += performance.now() - started;
  }
}
