import type { Reg, SkillEntry } from '../types';
import { SENKOU_PHASE1_COEFF, EFFECT_TYPE_TARGET_SPEED, EFFECT_TYPE_ACCEL, EFFECT_TYPE_CURRENT_SPEED } from '../constants';
import { baseSpeed, phaseStart } from './track';
import skillData from '../skill_data.json';
import skillNames from '../skillnames.json';

/** Calculate skill duration in seconds for a given course distance */
export function skillDurationSeconds(baseDurationJson: number, distance: number): number {
  return (baseDurationJson / 10000) * (distance / 1000);
}

/** Calculate skill distance in meters */
export function skillDistanceMeters(baseDurationJson: number, distance: number): number {
  const duration = skillDurationSeconds(baseDurationJson, distance);
  const speed = baseSpeed(distance) * SENKOU_PHASE1_COEFF;
  return duration * speed;
}

/** Calculate how many meters of a skill region overlap with the final leg (phase 2+3, from 2/3 distance to end) */
export function finalLegOverlap(activationRegions: Reg[], courseDistance: number): number {
  const finalLegStart = phaseStart(courseDistance, 2); // 2/3 of distance
  let total = 0;
  for (const r of activationRegions) {
    const overlapStart = Math.max(r.start, finalLegStart);
    const overlapEnd = Math.min(r.end, courseDistance);
    if (overlapEnd > overlapStart) {
      total += overlapEnd - overlapStart;
    }
  }
  return total;
}

export const getSkillTypeClass = (iconId: string | undefined, rarity: number): string => {
  if (!iconId) return '';
  const id = parseInt(iconId);

  // InheritedUnique: Rarity 1 but using a unique icon (3xxxx/4xxxx)
  if (rarity === 1 && id >= 30000) return 'umasType-inherited';

  // Main Unique / Evolution: Rarity 3+
  if (id >= 30000) return 'umasType-unique';

  // Middle digits (type code)
  const typeCode = Math.floor(id / 10) % 100;

  if (typeCode >= 1 && typeCode <= 19) return 'umasType-speed';
  if (typeCode >= 20 && typeCode <= 29) return 'umasType-recovery';
  if (typeCode >= 40 && typeCode <= 49) return 'umasType-debuff';

  return '';
};

/** Build a sorted list of skills that have duration-based speed/accel effects */
export function buildSkillList(): { id: string; name: string; baseDuration: number; rarity: number; effectSummary: string }[] {
  const sd = skillData as Record<string, SkillEntry>;
  const sn = skillNames as Record<string, string[]>;

  const skills: { id: string; name: string; baseDuration: number; rarity: number; effectSummary: string }[] = [];

  for (const [id, entry] of Object.entries(sd)) {
    const name = sn[id]?.[0];
    if (!name) continue;

    // Use the first alternative for display
    const alt = entry.alternatives[0];
    if (!alt || alt.baseDuration <= 0) continue;

    // Only include skills that have speed/accel effects (types 27, 31, 21)
    const hasRelevantEffect = alt.effects.some(e =>
      e.type === EFFECT_TYPE_TARGET_SPEED ||
      e.type === EFFECT_TYPE_ACCEL ||
      e.type === EFFECT_TYPE_CURRENT_SPEED
    );
    if (!hasRelevantEffect) continue;

    // Build a short effect summary
    const parts: string[] = [];
    for (const ef of alt.effects) {
      if (ef.type === EFFECT_TYPE_TARGET_SPEED) parts.push(`Spd+${ef.modifier / 10000}`);
      else if (ef.type === EFFECT_TYPE_ACCEL) parts.push(`Acc+${ef.modifier / 10000}`);
      else if (ef.type === EFFECT_TYPE_CURRENT_SPEED) parts.push(`CSpd+${ef.modifier / 10000}`);
    }

    skills.push({
      id,
      name,
      baseDuration: alt.baseDuration,
      rarity: entry.rarity,
      effectSummary: parts.join(', ')
    });
  }

  // Sort by rarity desc then name
  skills.sort((a, b) => {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    return a.name.localeCompare(b.name);
  });

  return skills;
}
