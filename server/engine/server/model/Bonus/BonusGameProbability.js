import BaseBonus from '../../../shared/model/BaseBonus.js';
import BonusGame from './BonusGame.js';
import { PICKUP_RUSH_CAP } from '../../manager/BonusManager.js';

/**
 * Probability Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusGameProbability(x, y)
{
    BonusGame.call(this, x, y);
}

BonusGameProbability.prototype = Object.create(BonusGame.prototype);
BonusGameProbability.prototype.constructor = BonusGameProbability;

/**
 * Get probability
 *
 * @param {Game} game
 *
 * @return {Number}
 */
BonusGameProbability.prototype.getProbability = function (game)
{
    var ratio = 1 - game.getAliveAvatars().count() / game.getPresentAvatars().count();

    if (ratio < 0.5) {
        return this.probability;
    }

    return Math.round((BaseBonus.prototype.probability - ratio) * 10) / 10;
};

BonusGameProbability.prototype.getEffects = function()
{
    return [['rushCap', PICKUP_RUSH_CAP]];
};
