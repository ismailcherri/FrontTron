export const arenaViews = {
  isometric: 'Isometric',
  'top-down': 'Classic top-down',
};
export const arenaShapes = {
  square: 'Square',
  widescreen: 'Widescreen (16:9)',
};
export function arenaShapeForView(view, shape) {
  return view === 'top-down' && shape === 'widescreen' ? 'widescreen' : 'square';
}
export function arenaDimensions(height, shape) {
  return { width: shape === 'widescreen' ? height * 16 / 9 : height, height };
}
export const bonuses = {
  BonusSelfFast: 'Afterburner',
  BonusEnemyFast: 'Enemy boost',
  BonusSelfSlow: 'Slow down',
  BonusEnemySlow: 'Enemy slowdown',
  BonusGameBorderless: 'Borderless',
  BonusSelfMaster: 'Ghost rider',
  BonusEnemyBig: 'Wide enemies',
  BonusAllColor: 'Color shuffle',
  BonusEnemyInverse: 'Reverse controls',
  BonusSelfSmall: 'Shrink rider',
  BonusGameClear: 'Clear arena',
  BonusEnemyStraightAngle: 'Right angles',
  BonusSelfInvincible: 'Invincibility',
  BonusGameProbability: 'Pickup rush',
  BonusAllColorBlack: 'Blackout',
  BonusAllDashed: 'Dashed trails',
  BonusSelfExplode: 'Explosion',
  BonusSelfYscaler: 'Yscaler',
};
export const presets = {
  All: Object.keys(bonuses),
  Solo: [
    'BonusSelfSmall',
    'BonusSelfSlow',
    'BonusSelfFast',
    'BonusSelfMaster',
    'BonusSelfInvincible',
    'BonusGameBorderless',
    'BonusGameClear',
    'BonusGameProbability',
  ],
  'Speed of light': ['BonusSelfFast', 'BonusEnemyFast'],
  'Super size me': ['BonusEnemyBig'],
  'No bonuses': [],
};
export const palette = ['#ffc44a', '#46e4d6', '#fa72b7', '#a68bff', '#82e471', '#6aafff'];
