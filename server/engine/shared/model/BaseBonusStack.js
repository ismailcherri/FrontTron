import Collection from '../Collection.js';
import EventEmitter from 'node:events';

/**
 * Base Bonus Stack
 *
 * @param {Object} target
 */
export default function BaseBonusStack (target)
{
    EventEmitter.call(this);

    this.target  = target;
    this.bonuses = new Collection();
    this.timers  = new Map();
}

BaseBonusStack.prototype = Object.create(EventEmitter.prototype);
BaseBonusStack.prototype.constructor = BaseBonusStack;

/**
 * Add bonus to the stack
 *
 * @param {Bonus} bonus
 */
BaseBonusStack.prototype.add = function(bonus)
{
    if (!this.bonuses.add(bonus)) return false;

    this.timers.set(bonus, setTimeout(() => this.remove(bonus), bonus.duration));
    const copies = this.bonuses.items.filter(active => active.constructor === bonus.constructor);
    if (copies.length > bonus.maxStacks) {
        // The replacement is already active when the oldest copy is removed.
        this.remove(copies[0]);
    } else {
        this.resolve();
    }
    return true;
};

/**
 * Remove bonus from the stack
 *
 * @param {Bonus} bonus
 */
BaseBonusStack.prototype.remove = function(bonus)
{
    if (!this.timers.has(bonus)) return false;
    clearTimeout(this.timers.get(bonus));
    this.timers.delete(bonus);
    this.bonuses.remove(bonus);
    this.resolve(bonus);
    return true;
};

/**
 * Clear
 */
BaseBonusStack.prototype.clear = function()
{
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.bonuses.clear();
};

/**
 * Resolve
 */
BaseBonusStack.prototype.resolve = function(bonus)
{
    var properties = {},
        effects, property, i, j;

    if (typeof(bonus) !== 'undefined') {
        effects = bonus.getEffects(this.target);
        for (i = effects.length - 1; i >= 0; i--) {
            property = effects[i][0];
            properties[property] = this.getDefaultProperty(property);
        }
    }

    for (i = this.bonuses.items.length - 1; i >= 0; i--) {
        effects = this.bonuses.items[i].getEffects(this.target);
        for (j = effects.length - 1; j >= 0; j--) {
            property = effects[j][0];

            if (typeof(properties[property]) === 'undefined') {
                properties[property] = this.getDefaultProperty(property);
            }

            this.append(properties, property, effects[j][1]);
        }
    }

    for (property in properties) {
        if (properties.hasOwnProperty(property)) {
            this.apply(property, properties[property]);
        }
    }
};

/**
 * Apply the value to target's property
 *
 * @param {String} property
 * @param {Number} value
 */
BaseBonusStack.prototype.apply = function(property, value)
{
    this.target[property] = value;
};

/**
 * Get default property
 *
 * @param {String} property
 *
 * @return {Number}
 */
BaseBonusStack.prototype.getDefaultProperty = function(property)
{
    return 0;
};

/**
 * Append
 *
 * @param {Object} properties
 * @param {String} property
 * @param {Number} value
 */
BaseBonusStack.prototype.append = function(properties, property, value)
{
    properties[property] += value;
};
