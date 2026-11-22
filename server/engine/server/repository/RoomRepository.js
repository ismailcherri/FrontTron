import Collection from '../../shared/Collection.js';
import EventEmitter from 'node:events';
import Room from '../model/Room.js';
import RoomNameGenerator from '../service/RoomNameGenerator.js';

/**
 * Room Repository
 */
export default function RoomRepository()
{
    EventEmitter.call(this);

    // Shared by live rooms. One bounded decision can finish after the budget,
    // then other rooms retain their steering and retry on their next tick.
    this.botBudget = {
        window: 0, used: 0,
        available(now) {
            if (now - this.window >= 16) { this.window = now; this.used = 0; }
            return this.used < 4;
        }
    };
    this.generator = new RoomNameGenerator();
    this.rooms     = new Collection([], 'name');

    this.onRoomClose = this.onRoomClose.bind(this);

}

RoomRepository.prototype = Object.create(EventEmitter.prototype);
RoomRepository.prototype.constructor = RoomRepository;

/**
 * Create a room
 *
 * @param {String} name
 *
 * @return {Room}
 */
RoomRepository.prototype.create = function(name)
{
    if (typeof(name) === 'undefined' || !name) {
        name = this.getRandomRoomName();
    }

    if (this.get(name)) return false;
    var room = new Room(name);
    room.botBudget = this.botBudget;

    if (!this.rooms.add(room)) { return false; }

    room.on('close', this.onRoomClose);
    this.emit('room:open', {room: room});

    return room;
};

/**
 * Delete a room
 *
 * @param {Room} room
 */
RoomRepository.prototype.remove = function(room)
{
    if (this.rooms.remove(room)) {
        this.emit('room:close', {room: room});

        return true;
    }

    return false;
};

/**
 * Get by name
 *
 * @param {String} name
 *
 * @return {Room}
 */
RoomRepository.prototype.get = function(name)
{
    return this.rooms.getById(name);
};

/**
 * Get all
 *
 * @return {Array}
 */
RoomRepository.prototype.all = function()
{
    return this.rooms.items;
};

/**
 * On room close
 *
 * @param {Object} data
 */
RoomRepository.prototype.onRoomClose = function(data)
{
    this.remove(data.room);
};

/**
 * Get random room name
 *
 * @return {String}
 */
RoomRepository.prototype.getRandomRoomName = function()
{
    var name = this.generator.getName();

    while (this.rooms.ids.indexOf(name) >= 0) {
        name = this.generator.getName();
    }

    return name;
};
