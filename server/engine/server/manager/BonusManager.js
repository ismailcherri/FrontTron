import BaseBonus from '../../shared/model/BaseBonus.js';
import BaseBonusManager from '../../shared/manager/BaseBonusManager.js';
import Body from '../core/Body.js';
import World from '../core/World.js';

export const PICKUP_RUSH_CAP = 10;
export const CLEANAGEDDON_CAP = 50;

/**
 * Bonus Manager
 *
 * @param {Game} game
 */
export default function BonusManager(game, bonuses, rate)
{
    BaseBonusManager.call(this, game);

    this.world           = new World(this.game.getDimensions(), 1);
    this.popingTimeout   = null;
    this.bonusTypes      = bonuses;
    this.bonusPopingTime = this.bonusPopingTime - ((this.bonusPopingTime/2) * rate);
    this.originalBonusPopingTime = this.bonusPopingTime;
    this.isCleanageddon  = false;

    this.popBonus = this.popBonus.bind(this);
}

BonusManager.prototype = Object.create(BaseBonusManager.prototype);
BonusManager.prototype.constructor = BonusManager;

BonusManager.prototype.setRushCap = function(cap)
{
    const interval = cap ? 100 : this.originalBonusPopingTime;
    if (this.bonusPopingTime !== interval) {
        this.bonusPopingTime = interval;
        if (this.popingTimeout) {
            clearTimeout(this.popingTimeout);
            this.popingTimeout = setTimeout(this.popBonus, this.getRandomPopingTime());
        }
    }
    this.bonusCap = cap || BaseBonusManager.prototype.bonusCap;
    const cleanageddon = cap === CLEANAGEDDON_CAP;
    if (this.isCleanageddon !== cleanageddon) {
        this.isCleanageddon = cleanageddon;
        this.game.emit('cleanageddon', cleanageddon);
    }
};

/**
 * Start
 */
BonusManager.prototype.start = function()
{
    BaseBonusManager.prototype.start.call(this);

    this.world.activate();

    if (this.bonusTypes.length) {
        this.popingTimeout = setTimeout(this.popBonus, this.getRandomPopingTime());
    }
};

/**
 * Stop
 */
BonusManager.prototype.stop = function()
{
    if (this.popingTimeout) {
        this.popingTimeout = clearTimeout(this.popingTimeout);
    }

    BaseBonusManager.prototype.stop.call(this);
};

/**
 * Clear
 */
BonusManager.prototype.clear = function()
{
    this.setRushCap(0);
    this.world.clear();
    BaseBonusManager.prototype.clear.call(this);
};

/**
 * Make a bonus 'pop'
 */
BonusManager.prototype.popBonus = function ()
{
    if (this.bonusTypes.length) {
        this.popingTimeout = setTimeout(this.popBonus, this.getRandomPopingTime());

        if (this.bonuses.count() < this.bonusCap) {
            var BonusType = this.getRandomBonusType();

            if (BonusType) {
                const levels = this.game.levelCount;
                const level = levels > 1 ? Math.floor(Math.random() * levels) : 0;
                var position = this.getRandomPosition(BaseBonus.prototype.radius, this.bonusPopingMargin, level);
                if (!position) return;
                var bonus = new BonusType(position[0], position[1]);
                this.add(bonus, level);
            }
        }
    }
};

/**
 * Get random position
 *
 * @param {Number} radius
 * @param {Number} border
 *
 * @return {Array}
 */
BonusManager.prototype.getRandomPosition = function(radius, border, level = 0)
{
    const arena = this.game.world;
    const margin = radius + border * arena.height;
    const body = new Body(0, 0, margin);
    body.level = level;
    for (let attempt = 0; attempt <= 100; attempt++) {
        arena.randomizePosition(body, margin);
        if (this.game.platforms?.links.some(link =>
            (level === link.lower || level === link.lower + 1) &&
            Math.hypot(body.x - link.x, body.y - link.y) < radius + link.radius)) continue;
        if (arena.testBody(body) && this.world.testBody(body)) return [body.x, body.y];
    }
    return null;
};

/**
 * Test if an avatar catches a bonus
 *
 * @param {Avatar} avatar
 */
BonusManager.prototype.testCatch = function(avatar)
{
    if (avatar.body) {
        var body  = this.world.getBody(avatar.body),
            bonus = body ? body.data : null;

        if (bonus && this.remove(bonus)) {
            bonus.applyTo(avatar, this.game);
        }
    }
};

/**
 * Add bonus
 *
 * @param {Bonus} bonus
 */
BonusManager.prototype.add = function (bonus, level = 0)
{
    if (BaseBonusManager.prototype.add.call(this, bonus)) {
        bonus.body.level = level;
        this.world.addBody(bonus.body);
        this.emit('bonus:pop', bonus);

        return true;
    }

    return false;
};

/**
 *  Remove bonus
 *
 * @param {Bonus} bonus
 */
BonusManager.prototype.remove = function(bonus)
{
    if (BaseBonusManager.prototype.remove.call(this, bonus)) {
        this.world.removeBody(bonus.body);
        this.emit('bonus:clear', bonus);

        return true;
    }

    return false;
};

/**
 * Get random printing time
 *
 * @return {Number}
 */
BonusManager.prototype.getRandomPopingTime  = function()
{
    return this.bonusPopingTime * (1 +  Math.random());
};

/**
 * Get random bonus type
 *
 * @return {Bonus}
 */
BonusManager.prototype.getRandomBonusType = function()
{
    if (!this.bonusTypes.length) { return null; }

    var total   = this.bonusTypes.length,
        pot     = [],
        bonuses = [],
        bonus,
        probability,
        bonusType;

    for (var i = 0; i < total; i++) {
        bonusType   = this.bonusTypes[i];
        probability = bonusType.prototype.getProbability(this.game);

        if (probability > 0) {
            bonuses.push(bonusType);
            pot.push(probability + (pot.at(-1) ?? 0));
        }
    }

    var value = Math.random() * pot[pot.length - 1];

    for (i = 0; i < total; i++) {
        if (value < pot[i]) {
            return bonuses[i];
        }
    }

    return null;
};

/**
 * Update size
 */
BonusManager.prototype.setSize = function()
{
    this.world.clear();
    this.world = new World(this.game.getDimensions(), 1);
};
