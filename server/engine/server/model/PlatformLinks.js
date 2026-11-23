import Body from '../core/Body.js';

const radius = 3.5;

// Both ends of a lift share world coordinates on adjacent decks.
export default class PlatformLinks {
    constructor(game) {
        this.game = game;
        this.links = [];
    }

    reset() {
        this.links = [];
        this.refresh();
    }

    refresh() {
        const next = new Map(this.links.map(link => [link.lower, link]));
        for (let lower = 0; lower < this.game.levelCount - 1; lower++) {
            const others = [...next.values()].filter(link => link.lower !== lower);
            const link = this.place(lower, others);
            if (link) next.set(lower, link);
        }
        this.links = [...next.values()];
        this.remaining = 10000 + Math.random() * 6000;
        this.game.emit('platform:links', this.links);
    }

    place(lower, others) {
        const {world, avatars, bonusManager} = this.game;
        const probe = new Body(0, 0, radius + 1);
        for (let attempt = 0; attempt < 40; attempt++) {
            world.randomizePosition(probe, radius + world.height * 0.08);
            const {x, y} = probe;
            if (others.some(link => Math.hypot(link.x - x, link.y - y) < radius * 3)) continue;
            if (avatars.items.some(a => a.alive && a.present &&
                (a.body.level === lower || a.body.level === lower + 1) &&
                Math.hypot(a.x - x, a.y - y) < radius + a.radius + 2)) continue;
            const clear = [lower, lower + 1].every(level => {
                probe.level = level;
                return world.testBody(probe) && bonusManager.world.testBody(probe);
            });
            if (clear) return {lower, x, y, radius};
        }
        return null;
    }

    tick(step) {
        this.remaining -= step;
        if (this.remaining <= 0) this.refresh();
    }

    cross(avatar, fromX, fromY) {
        const dx = avatar.x - fromX, dy = avatar.y - fromY;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) return;
        for (const link of this.links) {
            const level = avatar.body.level;
            if (level !== link.lower && level !== link.lower + 1) continue;
            const x = link.x - fromX, y = link.y - fromY;
            // Starting inside includes the arrival tick and prevents immediate return trips.
            if (x * x + y * y <= link.radius ** 2) continue;
            const t = Math.max(0, Math.min(1, (x * dx + y * dy) / lengthSquared));
            if ((x - t * dx) ** 2 + (y - t * dy) ** 2 <= link.radius ** 2) {
                avatar.tryTransfer(level === link.lower ? level + 1 : level - 1, this.game.world);
                return;
            }
        }
    }
}
