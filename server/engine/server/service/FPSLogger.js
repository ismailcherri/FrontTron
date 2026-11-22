import BaseFPSLogger from '../../shared/service/BaseFPSLogger.js';

/**
 * FPS Logger
 */
export default function FPSLogger()
{
    BaseFPSLogger.call(this);
}

FPSLogger.prototype = Object.create(BaseFPSLogger.prototype);
FPSLogger.prototype.constructor = FPSLogger;
