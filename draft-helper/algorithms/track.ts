import type { Course, CourseSegment, Reg } from '../types';

/** Phase boundaries matching CourseHelpers.phaseStart/phaseEnd */
export function phaseStart(distance: number, phase: number): number {
  switch (phase) {
    case 0: return 0;
    case 1: return distance * 1 / 6;
    case 2: return distance * 2 / 3;
    case 3: return distance * 5 / 6;
    default: return 0;
  }
}

export function phaseEnd(distance: number, phase: number): number {
  switch (phase) {
    case 0: return distance * 1 / 6;
    case 1: return distance * 2 / 3;
    case 2: return distance * 5 / 6;
    case 3: return distance;
    default: return distance;
  }
}

/** Get segment end from segment data (supports both {start,end} and {start,length}) */
export function segEnd(s: CourseSegment): number {
  if (s.end != null) return s.end;
  return s.start + (s.length || 0);
}

/** Calculate base speed for a given course distance */
export function baseSpeed(distance: number): number {
  return 20.0 - (distance - 2000) / 1000.0;
}

/** Determine the acceleration types for a course based on the 50m window from the final leg start */
export function getAccelerationTypes(course: Course): string[] {
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
