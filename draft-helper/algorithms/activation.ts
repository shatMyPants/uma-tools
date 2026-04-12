import type { Course, Reg } from '../types';
import { phaseStart, phaseEnd, segEnd } from './track';

// =========================================================================
// Activation region computation (following uma-skill-tools/ActivationConditions.ts)
// =========================================================================

/** Intersect two regions, returning null if no overlap */
export function regIntersect(a: Reg, b: Reg): Reg | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start < end ? { start, end } : null;
}

/** Intersect each region with a single bounds region */
export function intersectAll(regions: Reg[], bounds: Reg): Reg[] {
  const result: Reg[] = [];
  for (const r of regions) {
    const i = regIntersect(r, bounds);
    if (i) result.push(i);
  }
  return result;
}

/** Intersect each region with multiple targets (union of intersections) */
export function intersectMulti(regions: Reg[], targets: Reg[]): Reg[] {
  const result: Reg[] = [];
  for (const r of regions) {
    for (const t of targets) {
      const i = regIntersect(r, t);
      if (i) result.push(i);
    }
  }
  return result;
}

/**
 * Compute activation regions on the track for a skill, following the logic
 * from uma-skill-tools/ActivationConditions.ts.
 *
 * Starts with the full track [0, courseDistance] and narrows by intersecting
 * with each condition's spatial filter, exactly as the real simulator does.
 */
export function computeActivationRegions(
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
