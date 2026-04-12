export const SURFACE_NAMES = {
  1: 'Turf',
  2: 'Dirt'
} as const;

export const DISTANCE_TYPES = {
  1: 'Short',
  2: 'Mile',
  3: 'Medium',
  4: 'Long'
} as const;

export const ACCEL_TYPES: Record<string, string> = {
  'final_corner': 'Final Corner',
  'delayed_final_corner': 'Delayed Final Corner',
  'before_final_corner': 'Before Final Corner',
  'straight': 'Straight',
  'uphill': 'Uphill',
  'downhill': 'Downhill'
};

export const ACCEL_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'final_corner': { bg: 'rgba(248, 81, 73, 0.15)', color: '#ff7b72', border: 'rgba(248, 81, 73, 0.4)' },
  'delayed_final_corner': { bg: 'rgba(210, 153, 34, 0.15)', color: '#e3b341', border: 'rgba(210, 153, 34, 0.4)' },
  'before_final_corner': { bg: 'rgba(188, 140, 242, 0.15)', color: '#d2a8ff', border: 'rgba(188, 140, 242, 0.4)' },
  'straight': { bg: 'rgba(63, 185, 80, 0.15)', color: '#56d364', border: 'rgba(63, 185, 80, 0.4)' },
  'uphill': { bg: 'rgba(88, 166, 255, 0.15)', color: '#79c0ff', border: 'rgba(88, 166, 255, 0.4)' },
  'downhill': { bg: 'rgba(82, 195, 184, 0.15)', color: '#52c3b8', border: 'rgba(82, 195, 184, 0.4)' }
};

export const ACCEL_DESCRIPTIONS: Record<string, string> = {
  'final_corner': 'Final leg starts on the final corner, and there are no more corners.',
  'delayed_final_corner': 'The final leg starts in the 2nd half of the final corner.',
  'before_final_corner': 'The final leg starts on a corner that is NOT the final corner.',
  'straight': 'Final leg starts on a straight.',
  'uphill': 'Final leg starts on an uphill slope.',
  'downhill': 'Final leg starts on a downhill slope.'
};

export const ALL_ACCEL_TYPES = Object.keys(ACCEL_TYPES);

export const RARITY_CLASS: Record<number, string> = {
  1: 'umasRarity-white',
  2: 'umasRarity-gold',
  3: 'umasRarity-unique',
  4: 'umasRarity-unique',
  5: 'umasRarity-unique',
  6: 'umasRarity-pink'
};

export const SKILL_COLORS = ['#bc8cf2', '#e3b341', '#52c3b8', '#f85149', '#8cc5ff'];

// Senkou Phase 1 (Middle Leg) coefficient
export const SENKOU_PHASE1_COEFF = 0.991;

// Effect type constants
export const EFFECT_TYPE_TARGET_SPEED = 27;
export const EFFECT_TYPE_ACCEL = 31;
export const EFFECT_TYPE_CURRENT_SPEED = 21;
