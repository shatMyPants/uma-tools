import { render, h, Fragment } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import courseData from './course_data.json';
import trackNames from './tracknames.json';
import staminaResults from './stamina_results.json';
import skillNames from './skillnames.json';
import skillData from './skill_data.json';
import skillMeta from './skill_meta.json';
import { RaceTrack, RegionDisplayType } from '../components/RaceTrack';
import { Language } from '../components/Language';
import './app.css';

interface CourseSegment {
  start: number;
  length?: number;
  end?: number;
}

interface Course {
  distance: number;
  surface: number; // 1: Turf, 2: Dirt
  turn: number; // 1: Right, 2: Left, 3: Straight
  course: number; // For in/out logic
  raceTrackId: number;
  corners: CourseSegment[];
  straights: CourseSegment[];
  slopes: CourseSegment[];
  distanceType: number; // 1: Short, 2: Mile, 3: Medium, 4: Long
}

interface SkillEffect {
  modifier: number;
  target: number;
  type: number;
}

interface SkillAlternative {
  baseDuration: number;
  condition: string;
  effects: SkillEffect[];
  precondition: string;
}

interface SkillEntry {
  alternatives: SkillAlternative[];
  rarity: number;
}

const SURFACE_NAMES = {
  1: 'Turf',
  2: 'Dirt'
};

const TURN_NAMES = {
  1: 'Right',
  2: 'Left',
  3: 'Straight'
};

const DISTANCE_TYPES = {
  1: 'Short',
  2: 'Mile',
  3: 'Medium',
  4: 'Long'
};

const ACCEL_TYPES: Record<string, string> = {
  'final_corner': 'Final Corner',
  'delayed_final_corner': 'Delayed Final Corner',
  'before_final_corner': 'Before Final Corner',
  'straight': 'Straight',
  'uphill': 'Uphill',
  'downhill': 'Downhill'
};

const ACCEL_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'final_corner': { bg: 'rgba(248, 81, 73, 0.15)', color: '#ff7b72', border: 'rgba(248, 81, 73, 0.4)' },
  'delayed_final_corner': { bg: 'rgba(210, 153, 34, 0.15)', color: '#e3b341', border: 'rgba(210, 153, 34, 0.4)' },
  'before_final_corner': { bg: 'rgba(188, 140, 242, 0.15)', color: '#d2a8ff', border: 'rgba(188, 140, 242, 0.4)' },
  'straight': { bg: 'rgba(63, 185, 80, 0.15)', color: '#56d364', border: 'rgba(63, 185, 80, 0.4)' },
  'uphill': { bg: 'rgba(88, 166, 255, 0.15)', color: '#79c0ff', border: 'rgba(88, 166, 255, 0.4)' },
  'downhill': { bg: 'rgba(82, 195, 184, 0.15)', color: '#52c3b8', border: 'rgba(82, 195, 184, 0.4)' }
};

const ALL_ACCEL_TYPES = Object.keys(ACCEL_TYPES);

/** Determine the acceleration types for a course based on the 50m window from the final leg start */
function getAccelerationTypes(course: Course): string[] {
  const fls = course.distance * 2 / 3;
  const windowEnd = fls + 50;
  const window: Reg = { start: fls, end: windowEnd };
  const types: string[] = [];

  // Helper: does a segment [segStart, segEnd] overlap the window?
  const overlaps = (segStart: number, segEndPos: number) =>
    segStart < windowEnd && segEndPos > fls;

  // --- Corner checks ---
  if (course.corners.length > 0) {
    const finalCorner = course.corners[course.corners.length - 1];
    const fcStart = finalCorner.start;
    const fcEnd = fcStart + (finalCorner.length || 0);
    const fcMid = (fcStart + fcEnd) / 2;

    // Final Corner: first half of the final corner overlaps window
    if (overlaps(fcStart, fcMid)) {
      types.push('final_corner');
    }

    // Delayed Final Corner: second half of the final corner overlaps window
    if (overlaps(fcMid, fcEnd)) {
      types.push('delayed_final_corner');
    }

    // Before Final Corner: any corner that is NOT the final corner overlaps the window
    for (let i = 0; i < course.corners.length - 1; i++) {
      const c = course.corners[i];
      const cEnd = c.start + (c.length || 0);
      if (overlaps(c.start, cEnd)) {
        types.push('before_final_corner');
        break;
      }
    }
  }

  // --- Straight check ---
  for (const s of course.straights) {
    const sEnd = segEnd(s);
    if (overlaps(s.start, sEnd)) {
      types.push('straight');
      break;
    }
  }

  // --- Slope checks ---
  for (const s of course.slopes) {
    const sEnd = s.start + (s.length || 0);
    const slope = (s as any).slope || 0;
    if (overlaps(s.start, sEnd)) {
      if (slope > 0 && !types.includes('uphill')) types.push('uphill');
      if (slope < 0 && !types.includes('downhill')) types.push('downhill');
    }
  }

  return types;
}

const RARITY_CLASS: Record<number, string> = {
  1: 'umasRarity-white',
  2: 'umasRarity-gold',
  3: 'umasRarity-unique',
  4: 'umasRarity-unique',
  5: 'umasRarity-unique',
  6: 'umasRarity-pink'
};

// Senkou Phase 1 (Middle Leg) coefficient
const SENKOU_PHASE1_COEFF = 0.991;

// Effect type constants
const EFFECT_TYPE_TARGET_SPEED = 27;
const EFFECT_TYPE_ACCEL = 31;
const EFFECT_TYPE_CURRENT_SPEED = 21;

/** Calculate base speed for a given course distance */
function baseSpeed(distance: number): number {
  return 20.0 - (distance - 2000) / 1000.0;
}

/** Calculate Senkou Phase 1 target speed */
function senkouPhase1Speed(distance: number): number {
  return baseSpeed(distance) * SENKOU_PHASE1_COEFF;
}

/** Calculate skill duration in seconds for a given course distance */
function skillDurationSeconds(baseDurationJson: number, distance: number): number {
  return (baseDurationJson / 10000) * (distance / 1000);
}

/** Calculate skill distance in meters */
function skillDistanceMeters(baseDurationJson: number, distance: number): number {
  const duration = skillDurationSeconds(baseDurationJson, distance);
  const speed = senkouPhase1Speed(distance);
  return duration * speed;
}

// =========================================================================
// Activation region computation (following uma-skill-tools/ActivationConditions.ts)
// =========================================================================

interface Reg { start: number; end: number }

/** Phase boundaries matching CourseHelpers.phaseStart/phaseEnd */
function phaseStart(distance: number, phase: number): number {
  switch (phase) {
    case 0: return 0;
    case 1: return distance * 1 / 6;
    case 2: return distance * 2 / 3;
    case 3: return distance * 5 / 6;
    default: return 0;
  }
}

function phaseEnd(distance: number, phase: number): number {
  switch (phase) {
    case 0: return distance * 1 / 6;
    case 1: return distance * 2 / 3;
    case 2: return distance * 5 / 6;
    case 3: return distance;
    default: return distance;
  }
}

/** Intersect two regions, returning null if no overlap */
function regIntersect(a: Reg, b: Reg): Reg | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start < end ? { start, end } : null;
}

/** Intersect each region with a single bounds region */
function intersectAll(regions: Reg[], bounds: Reg): Reg[] {
  const result: Reg[] = [];
  for (const r of regions) {
    const i = regIntersect(r, bounds);
    if (i) result.push(i);
  }
  return result;
}

/** Intersect each region with multiple targets (union of intersections) */
function intersectMulti(regions: Reg[], targets: Reg[]): Reg[] {
  const result: Reg[] = [];
  for (const r of regions) {
    for (const t of targets) {
      const i = regIntersect(r, t);
      if (i) result.push(i);
    }
  }
  return result;
}

/** Get segment end from segment data (supports both {start,end} and {start,length}) */
function segEnd(s: CourseSegment): number {
  if (s.end != null) return s.end;
  return s.start + (s.length || 0);
}

/**
 * Compute activation regions on the track for a skill, following the logic
 * from uma-skill-tools/ActivationConditions.ts.
 *
 * Starts with the full track [0, courseDistance] and narrows by intersecting
 * with each condition's spatial filter, exactly as the real simulator does.
 */
function computeActivationRegions(
  condition: string,
  course: Course,
  skillDistMeters: number
): Reg[] {
  // Handle '@' alternatives (OR conditions — union of results)
  if (condition.includes('@')) {
    const alternatives = condition.split('@');
    const allRegions: Reg[] = [];
    for (const alt of alternatives) {
      allRegions.push(...computeActivationRegions(alt, course, skillDistMeters));
    }
    return allRegions;
  }

  let regions: Reg[] = [{ start: 0, end: course.distance }];
  const parts = condition.split('&');

  for (const part of parts) {
    if (regions.length === 0) break;

    // Parse condition: name operator value
    const match = part.match(/^([a-z_\d]+)(==|!=|>=|<=|>|<)(-?\d+)$/);
    if (!match) continue;

    const [, name, op, valStr] = match;
    const val = parseInt(valStr);

    switch (name) {
      // --- Phase conditions ---
      case 'phase': {
        if (op === '==') {
          regions = intersectAll(regions, { start: phaseStart(course.distance, val), end: phaseEnd(course.distance, val) });
        } else if (op === '>=') {
          regions = intersectAll(regions, { start: phaseStart(course.distance, val), end: course.distance });
        } else if (op === '>') {
          regions = intersectAll(regions, { start: phaseStart(course.distance, Math.min(val + 1, 3)), end: course.distance });
        } else if (op === '<') {
          regions = intersectAll(regions, { start: 0, end: phaseStart(course.distance, val) });
        } else if (op === '<=') {
          regions = intersectAll(regions, { start: 0, end: phaseEnd(course.distance, val) });
        }
        break;
      }

      case 'phase_random': {
        if (op === '==') {
          regions = intersectAll(regions, { start: phaseStart(course.distance, val), end: phaseEnd(course.distance, val) });
        }
        break;
      }

      case 'phase_laterhalf_random': {
        if (op === '==') {
          const ps = phaseStart(course.distance, val);
          const pe = phaseEnd(course.distance, val);
          regions = intersectAll(regions, { start: (ps + pe) / 2, end: pe });
        }
        break;
      }

      case 'phase_firsthalf_random': {
        if (op === '==') {
          const ps = phaseStart(course.distance, val);
          const pe = phaseEnd(course.distance, val);
          regions = intersectAll(regions, { start: ps, end: (ps + pe) / 2 });
        }
        break;
      }

      case 'phase_firstquarter_random': {
        if (op === '==') {
          const ps = phaseStart(course.distance, val);
          const pe = phaseEnd(course.distance, val);
          regions = intersectAll(regions, { start: ps, end: ps + (pe - ps) / 4 });
        }
        break;
      }

      case 'phase_corner_random': {
        if (op === '==') {
          const ps = phaseStart(course.distance, val);
          const pe = phaseEnd(course.distance, val);
          regions = intersectAll(regions, { start: ps, end: pe });
          const corners = course.corners
            .filter(c => (c.start >= ps && c.start < pe) || (c.start + (c.length || 0) >= ps && c.start + (c.length || 0) < pe))
            .map(c => ({ start: Math.max(c.start, ps), end: Math.min(c.start + (c.length || 0), pe) }));
          if (corners.length > 0) regions = intersectMulti(regions, corners);
          else regions = [];
        }
        break;
      }

      case 'phase_straight_random': {
        if (op === '==') {
          const ps = phaseStart(course.distance, val);
          const pe = phaseEnd(course.distance, val);
          regions = intersectAll(regions, { start: ps, end: pe });
          const straights = course.straights
            .map(s => ({ start: Math.max(s.start, ps), end: Math.min(segEnd(s), pe) }))
            .filter(s => s.start < s.end);
          if (straights.length > 0) regions = intersectMulti(regions, straights);
          else regions = [];
        }
        break;
      }

      // --- Distance rate ---
      case 'distance_rate': {
        if (op === '>=') {
          regions = intersectAll(regions, { start: course.distance * val / 100, end: course.distance });
        } else if (op === '<=') {
          regions = intersectAll(regions, { start: 0, end: course.distance * val / 100 });
        } else if (op === '>') {
          regions = intersectAll(regions, { start: course.distance * val / 100, end: course.distance });
        } else if (op === '<') {
          regions = intersectAll(regions, { start: 0, end: course.distance * val / 100 });
        }
        break;
      }

      case 'distance_rate_after_random': {
        if (op === '==') {
          regions = intersectAll(regions, { start: course.distance * val / 100, end: course.distance });
        }
        break;
      }

      // --- Remain distance ---
      case 'remain_distance': {
        if (op === '<=') {
          regions = intersectAll(regions, { start: course.distance - val, end: course.distance });
        } else if (op === '>=') {
          regions = intersectAll(regions, { start: 0, end: course.distance - val });
        } else if (op === '==') {
          regions = intersectAll(regions, { start: course.distance - val, end: course.distance - val + 1 });
        }
        break;
      }

      // --- Final corner ---
      case 'is_finalcorner': {
        if (course.corners.length === 0) { regions = []; break; }
        const fcStart = course.corners[course.corners.length - 1].start;
        if (op === '==' && val === 1) {
          regions = intersectAll(regions, { start: fcStart, end: course.distance });
        } else if (op === '==' && val === 0) {
          regions = intersectAll(regions, { start: 0, end: fcStart });
        }
        break;
      }

      case 'is_finalcorner_laterhalf': {
        if (course.corners.length === 0) { regions = []; break; }
        if (op === '==' && val === 1) {
          const fc = course.corners[course.corners.length - 1];
          const fcEnd = fc.start + (fc.length || 0);
          regions = intersectAll(regions, { start: (fc.start + fcEnd) / 2, end: fcEnd });
        }
        break;
      }

      case 'is_finalcorner_random': {
        if (course.corners.length === 0) { regions = []; break; }
        if (op === '==' && val === 1) {
          const fc = course.corners[course.corners.length - 1];
          regions = intersectAll(regions, { start: fc.start, end: fc.start + (fc.length || 0) });
        }
        break;
      }

      // --- Corner conditions ---
      case 'corner': {
        if (op === '==' && val === 0) {
          // Not in a corner
          let lastEnd = 0;
          const nonCorners: Reg[] = [];
          for (const c of course.corners) {
            if (c.start > lastEnd) nonCorners.push({ start: lastEnd, end: c.start });
            lastEnd = c.start + (c.length || 0);
          }
          if (lastEnd < course.distance) nonCorners.push({ start: lastEnd, end: course.distance });
          regions = intersectMulti(regions, nonCorners);
        } else if (op === '!=' && val === 0) {
          // In any corner
          const cornerRegs = course.corners.map(c => ({ start: c.start, end: c.start + (c.length || 0) }));
          regions = intersectMulti(regions, cornerRegs);
        } else if (op === '==' && val >= 1 && val <= 4) {
          // Specific corner number (1=first corner from end-counting perspective)
          if (course.corners.length + val >= 5) {
            const corners: Reg[] = [];
            for (let idx = course.corners.length + val - 5; idx >= 0; idx -= 4) {
              const c = course.corners[idx];
              corners.push({ start: c.start, end: c.start + (c.length || 0) });
            }
            regions = intersectMulti(regions, corners);
          } else {
            regions = [];
          }
        }
        break;
      }

      case 'corner_random': {
        if (op === '==') {
          const cornerIdx = course.corners.length + val - 5;
          if (cornerIdx >= 0 && cornerIdx < course.corners.length) {
            const c = course.corners[cornerIdx];
            regions = intersectAll(regions, { start: c.start, end: c.start + (c.length || 0) });
          } else {
            regions = [];
          }
        }
        break;
      }

      case 'all_corner_random': {
        if (op === '==' && val === 1) {
          const cornerRegs = course.corners.map(c => ({ start: c.start, end: c.start + (c.length || 0) }));
          regions = intersectMulti(regions, cornerRegs);
        }
        break;
      }

      // --- Straight conditions ---
      case 'straight_random': {
        if (op === '==' && val === 1) {
          const straightRegs = course.straights.map(s => ({ start: s.start, end: segEnd(s) }));
          regions = intersectMulti(regions, straightRegs);
        }
        break;
      }

      case 'straight_front_type': {
        if (op === '==') {
          const straights = course.straights
            .filter(s => (s as any).frontType === val)
            .map(s => ({ start: s.start, end: segEnd(s) }));
          regions = intersectMulti(regions, straights);
        }
        break;
      }

      case 'is_last_straight_onetime': {
        if (op === '==' && val === 1 && course.straights.length > 0) {
          const ls = course.straights[course.straights.length - 1];
          const lsStart = ls.start;
          regions = intersectAll(regions, { start: lsStart, end: Math.min(lsStart + 10, segEnd(ls)) });
        }
        break;
      }

      case 'is_last_straight': {
        if (op === '==' && val === 1 && course.straights.length > 0) {
          const ls = course.straights[course.straights.length - 1];
          regions = intersectAll(regions, { start: ls.start, end: segEnd(ls) });
        }
        break;
      }

      case 'last_straight_random': {
        if (op === '==' && val === 1 && course.straights.length > 0) {
          const ls = course.straights[course.straights.length - 1];
          regions = intersectAll(regions, { start: ls.start, end: segEnd(ls) });
        }
        break;
      }

      // --- Slope conditions ---
      case 'slope': {
        if (op === '==') {
          if (val === 1) { // Uphill
            const uphills = course.slopes.filter(s => ((s as any).slope || 0) > 0).map(s => ({ start: s.start, end: s.start + (s.length || 0) }));
            if (uphills.length > 0) regions = intersectMulti(regions, uphills);
            else regions = [];
          } else if (val === 2) { // Downhill
            const downhills = course.slopes.filter(s => ((s as any).slope || 0) < 0).map(s => ({ start: s.start, end: s.start + (s.length || 0) }));
            if (downhills.length > 0) regions = intersectMulti(regions, downhills);
            else regions = [];
          } else if (val === 0) { // Flat
            let lastEnd = 0;
            const flats: Reg[] = [];
            for (const s of course.slopes) {
              if (s.start > lastEnd) flats.push({ start: lastEnd, end: s.start });
              lastEnd = s.start + (s.length || 0);
            }
            if (lastEnd < course.distance) flats.push({ start: lastEnd, end: course.distance });
            if (flats.length > 0) regions = intersectMulti(regions, flats);
            else regions = [];
          }
        }
        break;
      }

      case 'up_slope_random': {
        if (op === '==' && val === 1) {
          const uphills = course.slopes.filter(s => ((s as any).slope || 0) > 0).map(s => ({ start: s.start, end: s.start + (s.length || 0) }));
          if (uphills.length > 0) regions = intersectMulti(regions, uphills);
          else regions = [];
        }
        break;
      }

      case 'down_slope_random': {
        if (op === '==' && val === 1) {
          const downhills = course.slopes.filter(s => ((s as any).slope || 0) < 0).map(s => ({ start: s.start, end: s.start + (s.length || 0) }));
          if (downhills.length > 0) regions = intersectMulti(regions, downhills);
          else regions = [];
        }
        break;
      }

      // --- Last spurt ---
      case 'is_lastspurt': {
        if (op === '==' && val === 1) {
          regions = intersectAll(regions, { start: phaseStart(course.distance, 2), end: course.distance });
        }
        break;
      }

      // --- Change order conditions (spatially restrict to final area) ---
      case 'change_order_up_end_after': {
        regions = intersectAll(regions, { start: phaseStart(course.distance, 2), end: course.distance });
        break;
      }

      case 'change_order_up_finalcorner_after': {
        if (course.corners.length > 0) {
          const fcStart = course.corners[course.corners.length - 1].start;
          regions = intersectAll(regions, { start: fcStart, end: course.distance });
        } else {
          regions = [];
        }
        break;
      }

      // --- Runtime-only conditions — no spatial restriction (noop) ---
      case 'order':
      case 'order_rate':
      case 'order_rate_in40_continue':
      case 'order_rate_in20_continue':
      case 'order_rate_in80_continue':
      case 'order_rate_out40_continue':
      case 'order_rate_out50_continue':
      case 'order_rate_out70_continue':
      case 'hp_per':
      case 'accumulatetime':
      case 'activate_count_all':
      case 'activate_count_heal':
      case 'activate_count_middle':
      case 'activate_count_start':
      case 'activate_count_end_after':
      case 'bashin_diff_behind':
      case 'bashin_diff_infront':
      case 'blocked_front':
      case 'blocked_front_continuetime':
      case 'blocked_side_continuetime':
      case 'blocked_all_continuetime':
      case 'change_order_onetime':
      case 'distance_diff_top':
      case 'distance_diff_rate':
      case 'is_overtake':
      case 'is_move_lane':
      case 'is_surrounded':
      case 'is_temptation':
      case 'is_badstart':
      case 'is_behind_in':
      case 'near_count':
      case 'overtake_target_time':
      case 'overtake_target_no_order_up_time':
      case 'temptation_count':
      case 'temptation_count_behind':
      case 'temptation_count_infront':
      case 'random_lot':
      case 'popularity':
      case 'post_number':
      case 'running_style':
      case 'running_style_count_same':
      case 'running_style_count_same_rate':
      case 'running_style_count_nige_otherself':
      case 'running_style_count_senko_otherself':
      case 'running_style_count_sashi_otherself':
      case 'running_style_count_oikomi_otherself':
      case 'running_style_equal_popularity_one':
      case 'running_style_temptation_count_nige':
      case 'running_style_temptation_count_senko':
      case 'running_style_temptation_count_sashi':
      case 'running_style_temptation_count_oikomi':
      case 'ground_type':
      case 'ground_condition':
      case 'distance_type':
      case 'rotation':
      case 'track_id':
      case 'grade':
      case 'weather':
      case 'season':
      case 'lane_type':
      case 'same_skill_horse_count':
      case 'behind_near_lane_time':
      case 'behind_near_lane_time_set1':
      case 'infront_near_lane_time':
      case 'always':
      case 'is_basis_distance':
      case 'is_hp_empty_onetime':
      case 'compete_fight_count':
        break;

      default:
        // Unknown — treat as noop
        break;
    }
  }

  // For each activation region, extend by the skill duration distance
  return regions.map(r => ({
    start: r.start,
    end: Math.min(r.start + skillDistMeters, course.distance)
  }));
}

/** Calculate how many meters of a skill region overlap with the final leg (phase 2+3, from 2/3 distance to end) */
function finalLegOverlap(activationRegions: Reg[], courseDistance: number): number {
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

// =========================================================================

/** Build a sorted list of skills that have duration-based speed/accel effects */
function buildSkillList(): { id: string; name: string; baseDuration: number; rarity: number; effectSummary: string }[] {
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

const RARITY_LABELS: Record<number, string> = {
  1: 'White',
  2: 'Gold',
  3: 'Unique',
  6: 'Evolution'
};

function SkillPill({ id, name, rarity, onClick, selected }: {
  id: string;
  name: string;
  rarity: number;
  onClick: (id: string) => void;
  selected: boolean;
}) {
  const iconId = (skillMeta as any)[id]?.iconId;
  const rarityClass = RARITY_CLASS[rarity] || 'umasRarity-white';

  return (
    <div
      className={`umasSkillPill ${rarityClass} ${selected ? 'selected' : ''}`}
      onClick={() => onClick(id)}
      title={name}
    >
      {iconId && (
        <img
          className="umasSkillPillIcon"
          src={`/uma-tools/icons/${iconId}.png`}
          loading="lazy"
        />
      )}
      <span className="umasSkillPillName">{name}</span>
    </div>
  );
}

const SKILL_COLORS = ['#bc8cf2', '#e3b341', '#52c3b8', '#f85149', '#8cc5ff'];

function SkillPicker({
  skills,
  selectedIds,
  onToggle
}: {
  skills: any[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return skills;
    const q = query.toLowerCase();
    return skills.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q));
  }, [skills, query]);

  return (
    <div className="umasSkillPicker">
      <div className="umasSkillSearchWrap">
        <input
          type="text"
          className="umasSkillSearch"
          placeholder="Search skills..."
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        {query && (
          <button className="umasSearchClear" onClick={() => setQuery('')}>×</button>
        )}
      </div>
      <div className="umasSkillGrid">
        {filtered.map(skill => (
          <SkillPill
            key={skill.id}
            id={skill.id}
            name={skill.name}
            rarity={skill.rarity}
            selected={selectedIds.includes(skill.id)}
            onClick={onToggle}
          />
        ))}
        {filtered.length === 0 && (
          <div className="umasEmpty">No skills found</div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [search, setSearch] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<string[]>(['1', '2']);
  const [distanceFilter, setDistanceFilter] = useState<string[]>(['1', '2', '3', '4']);
  const [accelTypeFilter, setAccelTypeFilter] = useState<string[]>(ALL_ACCEL_TYPES);
  const [raceTrackFilter, setRaceTrackFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'id' | 'distance' | 'surface'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  useEffect(() => {
    document.body.classList.add('dark');
  }, []);

  const skillList = useMemo(() => buildSkillList(), []);

  const toggleFocus = (id: string) => {
    setFocusedId(prev => prev === id ? null : id);
  };

  const handleSkillToggle = (id: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFilterClick = (value: string, current: string[], all: string[], setter: (v: string[]) => void) => {
    if (current.length === all.length) {
      setter([value]);
    } else if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  const handleFilterDblClick = (allValues: string[], setter: (v: string[]) => void) => {
    setter(allValues);
  };

  const selectedSkills = useMemo(() => {
    return selectedSkillIds.map(id => skillList.find(s => s.id === id)).filter(Boolean);
  }, [selectedSkillIds, skillList]);

  const mergedCourses = useMemo(() => {
    return Object.entries(courseData as Record<string, Course>).map(([id, course]) => {
      const stamina = staminaResults[id as keyof typeof staminaResults] || null;

      const frontPace = stamina ? (stamina as any).Senkou : 600;
      const lateEnd = stamina ? (stamina as any).Oikomi : 600;

      return {
        id,
        ...course,
        trackName: (trackNames as any)[course.raceTrackId]?.[1] || `Track ${course.raceTrackId}`,
        accelTypes: getAccelerationTypes(course),
        stamina: {
          frontPace: frontPace === -1 ? 600 : (frontPace || 600),
          lateEnd: lateEnd === -1 ? 600 : (lateEnd || 600),
          isDefault: !stamina
        }
      };
    });
  }, []);

  const uniqueRaceTracks = useMemo(() => {
    const tracks = new Map<number, string>();
    mergedCourses.forEach(c => {
      tracks.set(c.raceTrackId, c.trackName);
    });
    return Array.from(tracks.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [mergedCourses]);

  const filteredCourses = useMemo(() => {
    return mergedCourses.filter(course => {
      const q = search.toLowerCase();
      const matchesSearch = course.id.includes(search) ||
        course.trackName.toLowerCase().includes(q) ||
        course.distance.toString().includes(q);
      const matchesSurface = surfaceFilter.includes(course.surface.toString());
      const matchesDistance = distanceFilter.includes(course.distanceType.toString());
      const matchesRaceTrack = raceTrackFilter === 'all' || course.raceTrackId.toString() === raceTrackFilter;
      const matchesAccelType = accelTypeFilter.length === ALL_ACCEL_TYPES.length || course.accelTypes.some(t => accelTypeFilter.includes(t));

      return matchesSearch && matchesSurface && matchesDistance && matchesRaceTrack && matchesAccelType;
    });
  }, [search, surfaceFilter, distanceFilter, raceTrackFilter, accelTypeFilter, mergedCourses]);

  const sortedCourses = useMemo(() => {
    return [...filteredCourses].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'id') {
        cmp = a.id.localeCompare(b.id, undefined, { numeric: true });
      } else if (sortKey === 'distance') {
        cmp = a.distance - b.distance;
      } else if (sortKey === 'surface') {
        cmp = a.surface - b.surface;
      }

      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredCourses, sortKey, sortOrder]);

  return (
    <div className="container dark">
      <h1>Uma Course Visualiser</h1>

      <div className="controls">
        <div className="controls-row">
          <input
            type="text"
            placeholder="Search Track / Length / ID..."
            className="search-input"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />

          <select
            className="filter-select"
            value={raceTrackFilter}
            onChange={(e) => setRaceTrackFilter((e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Locations</option>
            {uniqueRaceTracks.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        <div className="controls-row">
          <div className="toggle-group-label">Distance:</div>
          <div className="toggle-group">
            {Object.entries(DISTANCE_TYPES).map(([id, label]) => (
              <button
                key={id}
                className={`toggle-btn ${distanceFilter.includes(id) ? 'active' : ''}`}
                onClick={() => handleFilterClick(id, distanceFilter, ['1', '2', '3', '4'], setDistanceFilter)}
                onDblClick={() => handleFilterDblClick(['1', '2', '3', '4'], setDistanceFilter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="controls-row">
          <div className="toggle-group-label">Track Type:</div>
          <div className="toggle-group">
            <button
              className={`toggle-btn turf ${surfaceFilter.includes('1') ? 'active' : ''}`}
              onClick={() => handleFilterClick('1', surfaceFilter, ['1', '2'], setSurfaceFilter)}
              onDblClick={() => handleFilterDblClick(['1', '2'], setSurfaceFilter)}
            >
              Turf
            </button>
            <button
              className={`toggle-btn dirt ${surfaceFilter.includes('2') ? 'active' : ''}`}
              onClick={() => handleFilterClick('2', surfaceFilter, ['1', '2'], setSurfaceFilter)}
              onDblClick={() => handleFilterDblClick(['1', '2'], setSurfaceFilter)}
            >
              Dirt
            </button>
          </div>
        </div>

        <div className="controls-row">
          <div className="toggle-group-label">Accel Type:</div>
          <div className="toggle-group accel-toggle-group">
            {Object.entries(ACCEL_TYPES).map(([key, label]) => (
              <button
                key={key}
                className={`toggle-btn accel-toggle ${accelTypeFilter.includes(key) ? 'active' : ''}`}
                style={accelTypeFilter.includes(key) ? {
                  background: ACCEL_TYPE_COLORS[key].bg,
                  color: ACCEL_TYPE_COLORS[key].color,
                  borderColor: ACCEL_TYPE_COLORS[key].border
                } : {}}
                onClick={() => handleFilterClick(key, accelTypeFilter, ALL_ACCEL_TYPES, setAccelTypeFilter)}
                onDblClick={() => handleFilterDblClick(ALL_ACCEL_TYPES, setAccelTypeFilter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="controls-row sort-row">
          <div className="toggle-group-label">Sort:</div>
          <select
            className="filter-select sort-select"
            value={sortKey}
            onChange={(e) => setSortKey((e.target as HTMLSelectElement).value as any)}
          >
            <option value="id">By Racecourse (ID)</option>
            <option value="distance">By Length</option>
            <option value="surface">By Ground Type</option>
          </select>
          <button
            className={`toggle-btn sort-order-btn ${sortOrder === 'desc' ? 'active' : ''}`}
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>
      </div>

      {/* Skill Selector */}
      <div className="skill-selector">
        <div className="skill-selector-header">
          <span className="skill-selector-title">Skill Duration Preview</span>
          <span className="skill-selector-strategy">Strategy: Senkou (Pace Chaser)</span>
        </div>

        <SkillPicker
          skills={skillList}
          selectedIds={selectedSkillIds}
          onToggle={handleSkillToggle}
        />

        {selectedSkills.length > 0 && (
          <div className="skill-info-container">
            {selectedSkills.map((skill, idx) => (
              <div key={skill.id} className="skill-info" style={{ borderLeft: `4px solid ${SKILL_COLORS[idx % SKILL_COLORS.length]}` }}>
                <span className="skill-info-name" style={{ color: SKILL_COLORS[idx % SKILL_COLORS.length] }}>{skill.name}</span>
                <span className="skill-info-detail">{(skill.baseDuration / 10000).toFixed(1)}s</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="course-grid">
        {sortedCourses.map(course => {
          const sd = skillData as Record<string, SkillEntry>;
          const regions: any[] = [];
          const skillPreviews: any[] = [];
          const isFocused = focusedId === course.id;

          selectedSkills.forEach((skill, idx) => {
            const skillDur = skillDurationSeconds(skill.baseDuration, course.distance);
            const skillDist = skillDistanceMeters(skill.baseDuration, course.distance);
            const color = SKILL_COLORS[idx % SKILL_COLORS.length];

            // Build regions for the RaceTrack overlay
            const entry = sd[skill.id];
            let activationRegs: Reg[] = [];
            if (entry) {
              const alt = entry.alternatives[0];
              activationRegs = computeActivationRegions(
                alt.condition,
                course,
                skillDist
              );
              activationRegs.forEach(r => {
                regions.push({
                  type: RegionDisplayType.Textbox,
                  color: { stroke: color, fill: color + '73' },
                  text: skill.name,
                  regions: [{ start: r.start, end: r.end }]
                });
              });
            }

            // Check if the skill has an acceleration effect
            const hasAccel = entry?.alternatives[0]?.effects.some(e => e.type === EFFECT_TYPE_ACCEL) || false;
            const finalLegDist = (hasAccel && activationRegs.length > 0)
              ? finalLegOverlap(activationRegs, course.distance)
              : null;

            skillPreviews.push({
              id: skill.id,
              name: skill.name,
              duration: skillDur,
              distance: skillDist,
              coverage: (skillDist / course.distance * 100).toFixed(1),
              finalLegDist,
              color: color
            });
          });

          return (
            <div
              key={course.id}
              className={`course-card ${course.surface === 1 ? 'turf' : 'dirt'} ${isFocused ? 'focused' : ''}`}
              onClick={() => toggleFocus(course.id)}
            >
              <div className="course-header">
                <div className="course-title-wrap">
                  <div className="course-name">
                    {course.trackName} {course.distance}m
                  </div>
                  <div className="accel-badges">
                    {course.accelTypes.map(type => (
                      <span
                        key={type}
                        className="accel-badge"
                        style={{
                          background: ACCEL_TYPE_COLORS[type].bg,
                          color: ACCEL_TYPE_COLORS[type].color,
                          borderColor: ACCEL_TYPE_COLORS[type].border
                        }}
                      >
                        {ACCEL_TYPES[type]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="course-type-info">
                  {DISTANCE_TYPES[course.distanceType as keyof typeof DISTANCE_TYPES]} {SURFACE_NAMES[course.surface as keyof typeof SURFACE_NAMES]}
                </div>
              </div>

              <div className="course-track">
                <RaceTrack
                  courseid={parseInt(course.id)}
                  regions={regions}
                  width={isFocused ? 1200 : 800}
                  height={isFocused ? 240 : 120}
                  xOffset={0}
                  yOffset={0}
                />
              </div>

              <div className="stamina-grid">
                <div className="stamina-item">
                  <span className="stamina-label">front/pace stamina requirement</span>
                  <span className={`stamina-value ${course.stamina.isDefault ? 'default' : ''}`}>
                    {course.stamina.frontPace}
                  </span>
                </div>
                <div className="stamina-item">
                  <span className="stamina-label">late/end stamina requirement</span>
                  <span className={`stamina-value ${course.stamina.isDefault ? 'default' : ''}`}>
                    {course.stamina.lateEnd}
                  </span>
                </div>
              </div>

              {skillPreviews.length > 0 && (
                <div className="skill-previews-container">
                  {skillPreviews.map(preview => (
                    <div key={preview.id} className="skill-preview" style={{ borderTop: `1px solid ${preview.color}44` }}>
                      <div className="skill-preview-row">
                        <span className="skill-preview-label" style={{ color: preview.color }}>{preview.name}</span>
                        <span className="skill-preview-value">{preview.duration.toFixed(2)}s / {preview.distance.toFixed(1)}m</span>
                      </div>
                      <div className="skill-preview-row">
                        <span className="skill-preview-label">Coverage</span>
                        <span className="skill-preview-value">{preview.coverage}%</span>
                      </div>
                      {preview.finalLegDist !== null && (
                        <div className="skill-preview-row">
                          <span className="skill-preview-label">Acceleration In Final Leg</span>
                          <span className="skill-preview-value accel">{preview.finalLegDist.toFixed(1)}m</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredCourses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          No courses found matching your filters.
        </div>
      )}
    </div>
  );
}

const AppWrapper = () => (
  <Language.Provider value="en">
    <App />
  </Language.Provider>
);

render(<AppWrapper />, document.getElementById('app')!);
