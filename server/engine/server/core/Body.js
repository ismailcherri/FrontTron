import Collection from '../../shared/Collection.js';

/**
 * Body
 *
 * @param {Float} x
 * @param {Float} y
 * @param {Number} radius
 * @param {Object} data
 */
export default function Body (x, y, radius, data)
{
    this.x       = x;
    this.y       = y;
    this.radius  = radius;
    this.level   = 0;
    this.data    = data;
    this.islands = new Collection();
    this.id      = null;
}

/**
 * Match?
 *
 * @param {Body} body
 *
 * @return {Boolean}
 */
Body.prototype.match = function(body)
{
    return true;
};
