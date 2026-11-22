import BonusSelf from './BonusSelf.js';
import { SIZE_STACK_LIMIT } from '../../../shared/model/BaseAvatar.js';

/**
 * Small Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusSelfSmall(x, y)
{
    BonusSelf.call(this, x, y);
}

BonusSelfSmall.prototype = Object.create(BonusSelf.prototype);
BonusSelfSmall.prototype.constructor = BonusSelfSmall;
BonusSelfSmall.prototype.maxStacks = SIZE_STACK_LIMIT;

/**
 * Duration
 *
 * @type {Number}
 */
BonusSelfSmall.prototype.duration = 7500;

/**
 * Get effects
 *
 * @param {Avatar} avatar
 *
 * @return {Array}
 */
BonusSelfSmall.prototype.getEffects = function(avatar)
{
    return [['radius', -1]];
};
