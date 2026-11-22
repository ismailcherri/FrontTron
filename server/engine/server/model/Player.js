import BasePlayer from '../../shared/model/BasePlayer.js';

/**
 * Player
 *
 * @param {SocketClient} client
 * @param {String} name
 * @param {String} color
 */
export default function Player(client, name, color)
{
    BasePlayer.call(this, client, name, color);
}

Player.prototype = Object.create(BasePlayer.prototype);
Player.prototype.constructor = Player;

/**
 * Serialize
 *
 * @return {Object}
 */
Player.prototype.serialize = function()
{
    var data = BasePlayer.prototype.serialize.call(this);

    data.active = this.client?.active ?? true;
    if (this.difficulty) data.difficulty = this.difficulty;

    return data;
};
