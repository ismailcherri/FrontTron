import BaseBonus from '../../../shared/model/BaseBonus.js';
import Body from '../../core/Body.js';

/**
 * Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function Bonus(x, y)
{
    BaseBonus.call(this, x, y);

    this.body    = new Body(this.x, this.y, this.radius, this);
    this.target  = null;
}

Bonus.prototype = Object.create(BaseBonus.prototype);
Bonus.prototype.constructor = Bonus;

// Fixed-strength pickups refresh one slot on each affected target.
Bonus.prototype.maxStacks = 1;

/**
 * Apply bonus callback
 */
Bonus.prototype.applyTo = function(avatar, game)
{
    this.target = this.getTarget(avatar, game);
    this.on();
};
