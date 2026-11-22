import BaseAvatar from '../../../shared/model/BaseAvatar.js';
import BonusSelf from './BonusSelf.js';

/**
 * Slow Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusSelfSlow(x, y)
{
    BonusSelf.call(this, x, y);
}

BonusSelfSlow.prototype = Object.create(BonusSelf.prototype);
BonusSelfSlow.prototype.constructor = BonusSelfSlow;
BonusSelfSlow.prototype.maxStacks = 2;

/**
 * Get effects
 *
 * @param {Avatar} avatar
 *
 * @return {Array}
 */
BonusSelfSlow.prototype.getEffects = function(avatar)
{
    return [['velocity', -BaseAvatar.prototype.velocity/2]];
};
