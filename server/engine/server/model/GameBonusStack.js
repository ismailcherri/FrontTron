import BaseBonusStack from '../../shared/model/BaseBonusStack.js';

/**
 * Game Bonus Stack
 *
 * @param {Game} game
 */
export default function GameBonusStack(game)
{
    BaseBonusStack.call(this, game);
}

GameBonusStack.prototype = Object.create(BaseBonusStack.prototype);
GameBonusStack.prototype.constructor = GameBonusStack;

GameBonusStack.prototype.append = function(properties, property, value)
{
    if (property === 'rushCap') {
        properties.rushCap = Math.max(properties.rushCap, value);
    } else {
        BaseBonusStack.prototype.append.call(this, properties, property, value);
    }
};

/**
 * Apply the value to target's property
 *
 * @param {String} property
 * @param {Number} value
 */
GameBonusStack.prototype.apply = function(property, value)
{
    switch (property) {
        case 'rushCap':
            this.target.bonusManager.setRushCap(value);
            break;
        case 'borderless':
            this.target.setBorderless(value ? true : false);
            break;
        default:
            BaseBonusStack.prototype.apply.call(this, property, value);
            break;
    }
};
