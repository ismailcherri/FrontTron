import Bonus from './Bonus.js';

/**
 * Enemy Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusEnemy(x, y)
{
    Bonus.call(this, x, y);
}

BonusEnemy.prototype = Object.create(Bonus.prototype);
BonusEnemy.prototype.constructor = BonusEnemy;

/**
 * Affect enemy
 *
 * @type {String}
 */
BonusEnemy.prototype.affect = 'enemy';

/**
 * Get target
 *
 * @param {Avatar} avatar
 * @param {Game} game
 *
 * @return {Object}
 */
BonusEnemy.prototype.getTarget = function(avatar, game)
{
    return game.avatars.filter(function () { return this.alive && !this.equal(avatar); }).items;
};

/**
 * Apply on
 */
BonusEnemy.prototype.on = function()
{
    for (var i = this.target.length - 1; i >= 0; i--) {
        this.target[i].bonusStack.add(this);
    }
};
