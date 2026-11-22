import BaseAvatar from '../../../shared/model/BaseAvatar.js';
import BonusEnemy from './BonusEnemy.js';

/**
 * Fast Enemy Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusEnemyFast(x, y)
{
    BonusEnemy.call(this, x, y);
}

BonusEnemyFast.prototype = Object.create(BonusEnemy.prototype);
BonusEnemyFast.prototype.constructor = BonusEnemyFast;
BonusEnemyFast.prototype.maxStacks = 3;

/**
 * Duration
 *
 * @type {Number}
 */
BonusEnemyFast.prototype.duration = 6000;

/**
 * Get effects
 *
 * @param {Avatar} avatar
 *
 * @return {Array}
 */
BonusEnemyFast.prototype.getEffects = function(avatar)
{
    return [['velocity', 0.75 * BaseAvatar.prototype.velocity]];
};
