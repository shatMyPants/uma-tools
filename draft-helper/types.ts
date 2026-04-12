export interface CourseSegment {
  start: number;
  length?: number;
  end?: number;
}

export interface Course {
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

export interface SkillEffect {
  modifier: number;
  target: number;
  type: number;
}

export interface SkillAlternative {
  baseDuration: number;
  condition: string;
  effects: SkillEffect[];
  precondition: string;
}

export interface SkillEntry {
  alternatives: SkillAlternative[];
  rarity: number;
}

export interface Reg { start: number; end: number }
