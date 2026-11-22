import BaseRoomConfig from '../../shared/model/BaseRoomConfig.js';
import BonusAllColor from './Bonus/BonusAllColor.js';
import BonusAllColorBlack from './Bonus/BonusAllColorBlack.js';
import BonusAllDashed from './Bonus/BonusAllDashed.js';
import BonusEnemyBig from './Bonus/BonusEnemyBig.js';
import BonusEnemyFast from './Bonus/BonusEnemyFast.js';
import BonusEnemyInverse from './Bonus/BonusEnemyInverse.js';
import BonusEnemySlow from './Bonus/BonusEnemySlow.js';
import BonusEnemyStraightAngle from './Bonus/BonusEnemyStraightAngle.js';
import BonusGameBorderless from './Bonus/BonusGameBorderless.js';
import BonusGameClear from './Bonus/BonusGameClear.js';
import BonusGameProbability from './Bonus/BonusGameProbability.js';
import BonusSelfExplode from './Bonus/BonusSelfExplode.js';
import BonusSelfFast from './Bonus/BonusSelfFast.js';
import BonusSelfInvincible from './Bonus/BonusSelfInvincible.js';
import BonusSelfMaster from './Bonus/BonusSelfMaster.js';
import BonusSelfSlow from './Bonus/BonusSelfSlow.js';
import BonusSelfSmall from './Bonus/BonusSelfSmall.js';
import BonusSelfYscaler from './Bonus/BonusSelfYscaler.js';

/**
 * Room Configuration
 *
 * @param {Room} room
 */
export default function RoomConfig(room)
{
    BaseRoomConfig.call(this, room);
}

RoomConfig.prototype = Object.create(BaseRoomConfig.prototype);
RoomConfig.prototype.constructor = RoomConfig;

/**
 * Bonus types
 *
 * @type {Array}
 */
RoomConfig.prototype.bonusTypes = {
    BonusSelfSmall: BonusSelfSmall,
    BonusSelfSlow: BonusSelfSlow,
    BonusSelfFast: BonusSelfFast,
    BonusSelfMaster: BonusSelfMaster,
    BonusEnemySlow: BonusEnemySlow,
    BonusEnemyFast: BonusEnemyFast,
    BonusEnemyBig: BonusEnemyBig,
    BonusEnemyInverse: BonusEnemyInverse,
    BonusGameBorderless: BonusGameBorderless,
    BonusAllColor: BonusAllColor,
    BonusGameClear: BonusGameClear,
    BonusEnemyStraightAngle: BonusEnemyStraightAngle,
    BonusSelfInvincible: BonusSelfInvincible,
    BonusGameProbability: BonusGameProbability,
    BonusAllColorBlack: BonusAllColorBlack,
    BonusAllDashed: BonusAllDashed,
    BonusSelfExplode: BonusSelfExplode,
    BonusSelfYscaler: BonusSelfYscaler
};

/**
 * Set open
 *
 * @param {Boolean} open
 */
RoomConfig.prototype.setOpen = function(open)
{
    if (this.open !== open) {
        this.open     = open;
        this.password = this.open ? null : this.generatePassword();

        this.emit('room:config:open', {room: this.room, open: this.open});

        return true;
    }

    return false;
};

/**
 * Get available bonuses
 *
 * @return {Array}
 */
RoomConfig.prototype.getBonuses = function()
{
    var bonuses = [];

    for (var bonus in this.bonuses) {
        if (this.bonuses[bonus]) {
            bonuses.push(this.bonusTypes[bonus]);
        }
    }

    return bonuses;
};
