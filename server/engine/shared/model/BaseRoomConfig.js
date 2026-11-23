import BonusAllColor from '../../server/model/Bonus/BonusAllColor.js';
import BonusAllColorBlack from '../../server/model/Bonus/BonusAllColorBlack.js';
import BonusAllDashed from '../../server/model/Bonus/BonusAllDashed.js';
import BonusEnemyBig from '../../server/model/Bonus/BonusEnemyBig.js';
import BonusEnemyFast from '../../server/model/Bonus/BonusEnemyFast.js';
import BonusEnemyInverse from '../../server/model/Bonus/BonusEnemyInverse.js';
import BonusEnemySlow from '../../server/model/Bonus/BonusEnemySlow.js';
import BonusEnemyStraightAngle from '../../server/model/Bonus/BonusEnemyStraightAngle.js';
import BonusGameBorderless from '../../server/model/Bonus/BonusGameBorderless.js';
import BonusGameClear from '../../server/model/Bonus/BonusGameClear.js';
import BonusGameProbability from '../../server/model/Bonus/BonusGameProbability.js';
import BonusSelfExplode from '../../server/model/Bonus/BonusSelfExplode.js';
import BonusSelfFast from '../../server/model/Bonus/BonusSelfFast.js';
import BonusSelfInvincible from '../../server/model/Bonus/BonusSelfInvincible.js';
import BonusSelfMaster from '../../server/model/Bonus/BonusSelfMaster.js';
import BonusSelfSlow from '../../server/model/Bonus/BonusSelfSlow.js';
import BonusSelfSmall from '../../server/model/Bonus/BonusSelfSmall.js';
import BonusSelfYscaler from '../../server/model/Bonus/BonusSelfYscaler.js';
import EventEmitter from 'node:events';
import { arenaShapeForView } from '../../../../public/catalog.js';

/**
 * Base room configuration
 */
export default function BaseRoomConfig(room)
{
    EventEmitter.call(this);

    this.room     = room;
    this.arenaView = 'isometric';
    this.isometricLevels = 1;
    this.topDownShape = 'widescreen';
    this.maxScore = null;
    this.open     = true;
    this.password = null;

    this.variables = {
        bonusRate: 0
    };

    this.bonuses  = {
        BonusSelfSmall: true,
        BonusSelfSlow: true,
        BonusSelfFast: true,
        BonusSelfMaster: true,
        BonusEnemySlow: true,
        BonusEnemyFast: true,
        BonusEnemyBig: true,
        BonusEnemyInverse: true,
        BonusEnemyStraightAngle: true,
        BonusGameBorderless: true,
        BonusAllColor: true,
        BonusGameClear: true,
        BonusSelfInvincible: true,
        BonusGameProbability: true,
        BonusAllColorBlack: true,
        BonusAllDashed: true,
        BonusSelfExplode: true,
        BonusSelfYscaler: true
    };
}

BaseRoomConfig.prototype = Object.create(EventEmitter.prototype);
BaseRoomConfig.prototype.constructor = BaseRoomConfig;

Object.defineProperty(BaseRoomConfig.prototype, 'arenaShape', {
    get() { return arenaShapeForView(this.arenaView, this.topDownShape); }
});

/**
 * Password length
 *
 * @type {Number}
 */
BaseRoomConfig.prototype.passwordLength = 4;

/**
 * Set max score
 *
 * @param {Number} maxScore
 */
BaseRoomConfig.prototype.setMaxScore = function(maxScore)
{
    maxScore = parseInt(maxScore, 10);

    this.maxScore = maxScore ? maxScore : null;

    return true;
};

/**
 * Variable exists
 *
 * @param {String} variable
 *
 * @return {Boolean}
 */
BaseRoomConfig.prototype.variableExists = function(variable)
{
    return typeof(this.variables[variable]) !== 'undefined';
};

/**
 * Set variable
 *
 * @param {String} variable
 * @param {Float} value
 */
BaseRoomConfig.prototype.setVariable = function(variable, value)
{
    if (!this.variableExists(variable)) { return false; }

    value = parseFloat(value);

    if (-1 > value || value > 1 ) { return false; }

    this.variables[variable] = value;

    return true;
};

/**
 * Get variable
 *
 * @param {String} variable
 *
 * @return {Float}
 */
BaseRoomConfig.prototype.getVariable = function(variable)
{
    if (!this.variableExists(variable)) { return; }

    return this.variables[variable];
};

/**
 * Bonus exists
 *
 * @param {String} bonus
 *
 * @return {Boolean}
 */
BaseRoomConfig.prototype.bonusExists = function(bonus)
{
    return typeof(this.bonuses[bonus]) !== 'undefined';
};

/**
 * Toggle bonus
 *
 * @param {String} bonus
 *
 * @return {Boolean}
 */
BaseRoomConfig.prototype.toggleBonus = function(bonus)
{
    if (!this.bonusExists(bonus)) { return false; }

    this.bonuses[bonus] = !this.bonuses[bonus];

    return true;
};

/**
 * Get bonus value
 *
 * @param {String} bonus
 *
 * @return {Boolean}
 */
BaseRoomConfig.prototype.getBonus = function(bonus)
{
    if (!this.bonusExists(bonus)) { return; }

    return this.bonuses[bonus];
};

/**
 * Set bonus value
 *
 * @param {String} bonus
 * @param {Boolean} value
 *
 * @return {Boolean}
 */
BaseRoomConfig.prototype.setBonus = function(bonus, value)
{
    if (!this.bonusExists(bonus)) { return; }

    this.bonuses[bonus] = value ? true : false;
};

/**
 * Get max score
 *
 * @return {Number}
 */
BaseRoomConfig.prototype.getMaxScore = function()
{
    return this.maxScore ? this.maxScore : this.getDefaultMaxScore();
};

/**
 * Get max score
 *
 * @param {Number} players
 *
 * @return {Number}
 */
BaseRoomConfig.prototype.getDefaultMaxScore = function()
{
    return Math.max(1, (this.room.players.count() - 1) * 10);
};

/**
 * Authorise joinning the room
 *
 * @param {String} password
 *
 * @return {Boolean}
 */
BaseRoomConfig.prototype.allow = function(password)
{
    return this.open || this.password === password;
};

/**
 * Generate password
 *
 * @return {String}
 */
BaseRoomConfig.prototype.generatePassword = function()
{
    var password = '';

    for (var i = 0; i < this.passwordLength; i++) {
        password += Math.ceil(Math.random() * 9).toString();
    }

    return password;
};

/**
 * Serialize
 *
 * @return {Object}
 */
BaseRoomConfig.prototype.serialize = function()
{
    return {
        arenaView: this.arenaView,
        isometricLevels: this.isometricLevels,
        arenaShape: this.arenaShape,
        maxScore: this.maxScore,
        variables: this.variables,
        bonuses: this.bonuses,
        open: this.open,
        password: this.password
    };
};
