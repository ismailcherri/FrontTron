import BaseBonus from '../../../shared/model/BaseBonus.js';
import BonusGame from './BonusGame.js';
import { CLEANAGEDDON_CAP } from '../../manager/BonusManager.js';

/**
 * Master Bonus
 *
 * @param {Number} x
 * @param {Number} y
 */
export default function BonusGameClear(x, y)
{
    BonusGame.call(this, x, y);
}

BonusGameClear.prototype = Object.create(BonusGame.prototype);
BonusGameClear.prototype.constructor = BonusGameClear;

/**
 * Get probability
 *
 * @param {Game} game
 *
 * @return {Number}
 */
BonusGameClear.prototype.getProbability = function (game)
{
    var ratio = 1 - game.getAliveAvatars().count() / game.getPresentAvatars().count();

    if (ratio < 0.5) {
        return this.probability;
    }

    return Math.round((BaseBonus.prototype.probability - ratio) * 10) / 10;
};

/**
 * Apply on
 */
BonusGameClear.prototype.on = function()
{
    this.target.clearTrails();

    if (this.target.isCleanageddon()) {
        BonusGame.prototype.on.call(this);
    }
};

BonusGameClear.prototype.getEffects = function()
{
    return [['rushCap', CLEANAGEDDON_CAP]];
};
