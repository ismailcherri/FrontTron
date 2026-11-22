export { drivingSchema as schema } from '../../public/bots.js';
export function classify(trees, inputs) {
  const votes = [0, 0, 0];
  for (const tree of trees) {
    let node = tree;
    while (Array.isArray(node)) node = inputs[node[0]] <= node[1] ? node[2] : node[3];
    votes[node + 1]++;
  }
  const max = Math.max(...votes);
  return votes[1] === max ? 0 : votes[0] === max ? -1 : 1;
}
