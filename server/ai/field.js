// A fine-grained index of the same trail discs used by World. Never advance a live
// avatar or its trail counter while probing hypothetical positions.
const cell = 4;
export class TrailField {
  constructor(size) {
    this.width = Math.ceil(size / cell) + 2;
    this.clear();
  }
  clear() {
    this.cells = new Map();
  }
  add(body) {
    const { x, y, radius } = body;
    for (let j = Math.floor((y - radius) / cell); j <= Math.floor((y + radius) / cell); j++) {
      for (let i = Math.floor((x - radius) / cell); i <= Math.floor((x + radius) / cell); i++) {
        const key = j * this.width + i;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(body);
      }
    }
  }
  blocked(x, y, radius, avatar, num) {
    for (let j = Math.floor((y - radius) / cell); j <= Math.floor((y + radius) / cell); j++) {
      for (let i = Math.floor((x - radius) / cell); i <= Math.floor((x + radius) / cell); i++) {
        const bucket = this.cells.get(j * this.width + i);
        if (!bucket) continue;
        for (const b of bucket) {
          if (b.data === avatar && num - b.num <= avatar.trailLatency) continue;
          if ((x - b.x) ** 2 + (y - b.y) ** 2 < (radius + b.radius) ** 2) return true;
        }
      }
    }
    return false;
  }
}
