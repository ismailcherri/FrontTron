import BaseAvatar from '../../../shared/model/BaseAvatar.js';
import BonusSelf from './BonusSelf.js';

/**
 * Yscaler Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusSelfYscaler(x, y)
{
    BonusSelf.call(this, x, y);
}

BonusSelfYscaler.prototype = Object.create(BonusSelf.prototype);
BonusSelfYscaler.prototype.constructor = BonusSelfYscaler;

/**
 * Get effects
 *
 * @param {Avatar} avatar
 *
 * @return {Array}
 */
BonusSelfYscaler.prototype.getEffects = function(avatar)
{
    return [['velocity', -BaseAvatar.prototype.velocity]];
};
