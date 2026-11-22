import BonusEnemy from './BonusEnemy.js';
import { SIZE_STACK_LIMIT } from '../../../shared/model/BaseAvatar.js';

/**
 * Big Enemy Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusEnemyBig(x, y)
{
    BonusEnemy.call(this, x, y);
}

BonusEnemyBig.prototype = Object.create(BonusEnemy.prototype);
BonusEnemyBig.prototype.constructor = BonusEnemyBig;
BonusEnemyBig.prototype.maxStacks = SIZE_STACK_LIMIT;

/**
 * Duration
 *
 * @type {Number}
 */
BonusEnemyBig.prototype.duration = 7500;

/**
 * Get effects
 *
 * @param {Avatar} avatar
 *
 * @return {Array}
 */
BonusEnemyBig.prototype.getEffects = function(avatar)
{
    return [['radius', 1]];
};
