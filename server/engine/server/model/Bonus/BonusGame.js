import Bonus from './Bonus.js';

/**
 * Game Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusGame(x, y)
{
    Bonus.call(this, x, y);
}

BonusGame.prototype = Object.create(Bonus.prototype);
BonusGame.prototype.constructor = BonusGame;

/**
 * Affect game
 *
 * @type {String}
 */
BonusGame.prototype.affect = 'game';

/**
 * Get target
 *
 * @param {Avatar} avatar
 * @param {Game} game
 *
 * @return {Object}
 */
BonusGame.prototype.getTarget = function(avatar, game)
{
    return game;
};

/**
 * Apply on
 */
BonusGame.prototype.on = function()
{
    if (this.target) {
        this.target.bonusStack.add(this);
    }
};
