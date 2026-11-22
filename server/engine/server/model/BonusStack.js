import Avatar from './Avatar.js';
import { MAX_SIZE_LEVEL } from '../../shared/model/BaseAvatar.js';
import BaseBonusStack from '../../shared/model/BaseBonusStack.js';

// Each ceiling is the strength of three ordinary pickups affecting that stat.
const MAX_SPEED_MULTIPLIER = 3.25;
const MAX_HOLE_DISTANCE = 35;

/**
 * Bonus Stack
 *
 * @param {Avatar} avatar
 */
export default function BonusStack(avatar)
{
    BaseBonusStack.call(this, avatar);
}

BonusStack.prototype = Object.create(BaseBonusStack.prototype);
BonusStack.prototype.constructor = BonusStack;

/**
 * Add bonus to the stack
 *
 * @param {Bonus} bonus
 */
BonusStack.prototype.add = function(bonus)
{
    if (!BaseBonusStack.prototype.add.call(this, bonus)) return;
    this.emit('change', {avatar: this.target, method: 'add', bonus: bonus});
};

/**
 * Remove bonus from the stack
 *
 * @param {Bonus} bonus
 */
BonusStack.prototype.remove = function(bonus)
{
    if (!BaseBonusStack.prototype.remove.call(this, bonus)) return;
    this.emit('change', {avatar: this.target, method: 'remove', bonus: bonus});
};

/**
 * Apply the value to target's property
 *
 * @param {String} property
 * @param {Number} value
 */
BonusStack.prototype.apply = function(property, value)
{
    switch (property) {
        case 'radius':
            this.target.setRadius(Avatar.prototype.radius * 2 ** Math.min(value, MAX_SIZE_LEVEL));
            break;
        case 'velocity':
            this.target.setVelocity(Math.min(value, Avatar.prototype.velocity * MAX_SPEED_MULTIPLIER));
            break;
        case 'inverse':
            this.target.setInverse(Boolean(value));
            break;
        case 'directionInLoop':
            if (this.target.directionInLoop !== value) {
                this.target.directionInLoop = value;
                if (value) {
                    this.target.updateBaseAngularVelocity();
                } else {
                    this.target.angularVelocityBase = Math.PI / 2;
                    this.target.updateAngularVelocity();
                }
            }
            break;
        case 'invincible':
            this.target.setInvincible(value ? true : false);
            break;
        case 'printing':
            this.target.printManager[value > 0 ? 'start' : 'stop']();
            break;
        case 'color':
            this.target.setColor(value);
            break;
        case 'dashed':
            this.target.printManager.holeDistance = Math.min(value, MAX_HOLE_DISTANCE);
            break;
        default:
            BaseBonusStack.prototype.apply.call(this, property, value);
            break;
    }
};

/**
 * Get default property
 *
 * @param {String} property
 *
 * @return {Number}
 */
BonusStack.prototype.getDefaultProperty = function(property)
{
    switch (property) {
        case 'printing':
            return 1;
        case 'radius':
            return 0;
        case 'color':
            return this.target.player.color;
        case 'dashed':
            return 5;
        default:
            return Avatar.prototype[property];
    }
};

/**
 * Append
 *
 * @param {Object} properties
 * @param {String} property
 * @param {Number} value
 */
BonusStack.prototype.append = function(properties, property, value)
{
    switch (property) {
        case 'directionInLoop':
        case 'color':
            properties[property] = value;
            break;

        default:
            BaseBonusStack.prototype.append.call(this, properties, property, value);
            break;
    }
};
