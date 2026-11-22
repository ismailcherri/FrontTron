import BaseAvatar from '../../../shared/model/BaseAvatar.js';
import BonusEnemy from './BonusEnemy.js';

/**
 * Slow Enemy Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusEnemySlow(x, y)
{
    BonusEnemy.call(this, x, y);
}

BonusEnemySlow.prototype = Object.create(BonusEnemy.prototype);
BonusEnemySlow.prototype.constructor = BonusEnemySlow;

/**
 * Get effects
 *
 * @param {Avatar} avatar
 *
 * @return {Array}
 */
BonusEnemySlow.prototype.getEffects = function(avatar)
{
    return [['velocity', -BaseAvatar.prototype.velocity/2]];
};
