import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import type { SkillEntry, Reg } from '../types';
import { ACCEL_TYPES, ACCEL_TYPE_COLORS, ACCEL_DESCRIPTIONS, DISTANCE_TYPES, SURFACE_NAMES, SKILL_COLORS, EFFECT_TYPE_ACCEL } from '../constants';
import { skillDurationSeconds, skillDistanceMeters, finalLegOverlap } from '../algorithms/skill';
import { computeActivationRegions } from '../algorithms/activation';
import { RaceTrack, RegionDisplayType } from '../../components/RaceTrack';
import skillData from '../skill_data.json';

interface CourseCardProps {
  course: any;
  isFocused: boolean;
  isModal?: boolean;
  onToggleFocus: (id: string) => void;
  selectedSkills: any[];
  showSkillsOnMap: boolean;
  showSkillPreviews: boolean;
  onToggleSkillPreviews: () => void;
}

const sd = skillData as Record<string, SkillEntry>;

export function CourseCard({
  course,
  isFocused,
  isModal = false,
  onToggleFocus,
  selectedSkills,
  showSkillsOnMap,
  showSkillPreviews,
  onToggleSkillPreviews
}: CourseCardProps) {
  // Memoize the heavy activation region computation — only recompute when
  // the selected skills or course change, not on every toggle of show/hide.
  const { regions, skillPreviews } = useMemo(() => {
    const regions: any[] = [];
    const skillPreviews: any[] = [];

    selectedSkills.forEach((skill, idx) => {
      const skillDur = skillDurationSeconds(skill.baseDuration, course.distance);
      const skillDist = skillDistanceMeters(skill.baseDuration, course.distance);
      const color = SKILL_COLORS[idx % SKILL_COLORS.length];

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
        color
      });
    });

    return { regions, skillPreviews };
  }, [selectedSkills, course.id]);

  return (
    <div
      className={`course-card ${course.surface === 1 ? 'turf' : 'dirt'} ${isModal ? 'modal-view' : ''}`}
      onClick={() => !isModal && onToggleFocus(course.id)}
    >
      <div className="course-header">
        <div className="course-title-wrap">
          <div className="course-name">
            {course.trackName}
          </div>
          <div className="accel-badges">
            {course.course >= 2 && course.course <= 4 && (
              <span className="badge badge-lane">
                {['', '', 'Inner', 'Outer', 'Outer→Inner'][course.course]}
              </span>
            )}
            {course.accelTypes.map((type: string) => (
              <span
                key={type}
                className="accel-badge"
                title={ACCEL_DESCRIPTIONS[type]}
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
          regions={showSkillsOnMap ? regions : []}
          width={isModal ? 1200 : 800}
          height={isModal ? 240 : 120}
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
        <div 
          className={`skill-previews-container ${(!showSkillPreviews && !isModal) ? 'collapsed' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isModal) onToggleSkillPreviews();
          }}
        >
          {(!showSkillPreviews && !isModal) ? (
            <div className="skill-previews-collapsed">
              <span>Click to show {skillPreviews.length} skills</span>
              <span className="chevron">▶</span>
            </div>
          ) : (
            skillPreviews.map(preview => (
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
