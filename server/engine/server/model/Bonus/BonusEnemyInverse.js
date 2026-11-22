import BonusEnemy from './BonusEnemy.js';

/**
 * Inverse Enemy Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusEnemyInverse(x, y)
{
    BonusEnemy.call(this, x, y);
}

BonusEnemyInverse.prototype = Object.create(BonusEnemy.prototype);
BonusEnemyInverse.prototype.constructor = BonusEnemyInverse;

/**
 * Probability
 *
 * @type {Number}
 */
BonusEnemyInverse.prototype.probability = 0.8;

/**
 * Get effects
 *
 * @param {Avatar} avatar
 *
 * @return {Array}
 */
BonusEnemyInverse.prototype.getEffects = function(avatar)
{
    return [['inverse', 1]];
};
