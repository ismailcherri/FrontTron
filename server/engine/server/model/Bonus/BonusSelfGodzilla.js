import BonusSelf from './BonusSelf.js';

/**
 * Godzilla Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusSelfGodzilla(x, y)
{
    BonusSelf.call(this, x, y);
}

BonusSelfGodzilla.prototype = Object.create(BonusSelf.prototype);
BonusSelfGodzilla.prototype.constructor = BonusSelfGodzilla;

/**
 * Get effects
 *
 * @param {Avatar} avatar
 *
 * @return {Array}
 */
BonusSelfGodzilla.prototype.getEffects = function(avatar)
{
    return [
        ['invincible', true],
        ['printing', 100],
        ['radius', 10],
        ['velocity', 6]
    ];
};
