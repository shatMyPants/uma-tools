import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { CoursePicker } from './CoursePicker';
import { CourseCard } from './CourseCard';
import { SkillPicker } from './SkillPicker';
import { SkillPill } from './SkillPill';
import { SKILL_COLORS } from '../constants';

interface DraftVisualiserProps {
  courses: any[];
  selectedSkills: any[];
  skillList: any[];
  selectedSkillIds: string[];
  onToggleSkill: (id: string) => void;
  showSkillsOnMap: boolean;
  showSkillPreviews: boolean;
  onToggleSkillPreviews: () => void;
  draft: {
    tiebreak: string | null;
    home: (string | null)[];
    opponent: (string | null)[];
  };
  onUpdateDraft: (draft: any) => void;
  focusedId: string | null;
  onSetFocusedId: (id: string | null) => void;
}

export function DraftVisualiser({
  courses,
  selectedSkills,
  skillList,
  selectedSkillIds,
  onToggleSkill,
  showSkillsOnMap,
  showSkillPreviews,
  onToggleSkillPreviews,
  draft,
  onUpdateDraft,
  focusedId,
  onSetFocusedId
}: DraftVisualiserProps) {
  const [isSkillPickerExpanded, setIsSkillPickerExpanded] = useState(false);
  const [isMiddleMinimized, setIsMiddleMinimized] = useState(false);
  const [isHomeMinimized, setIsHomeMinimized] = useState(false);
  const [isOpponentMinimized, setIsOpponentMinimized] = useState(false);

  const updateTiebreak = (course: any) => {
    onUpdateDraft((prev: any) => ({ ...prev, tiebreak: course.id }));
  };

  const updateHome = (index: number, course: any) => {
    onUpdateDraft((prev: any) => {
      const newHome = [...prev.home];
      newHome[index] = course.id;
      return { ...prev, home: newHome };
    });
  };

  const updateOpponent = (index: number, course: any) => {
    onUpdateDraft((prev: any) => {
      const newOpponent = [...prev.opponent];
      newOpponent[index] = course.id;
      return { ...prev, opponent: newOpponent };
    });
  };

  const clearDraft = () => {
    if (confirm('Clear the entire draft?')) {
      onUpdateDraft({
        tiebreak: null,
        home: [null, null, null, null],
        opponent: [null, null, null, null]
      });
    }
  };

  const renderSlot = (courseId: string | null, label: string, onSelect: (course: any) => void) => {
    const course = courseId ? courses.find(c => c.id === courseId) : null;

    return (
      <div className={`draft-slot ${!course ? 'empty' : 'filled'}`}>
        {!course ? (
          <div className="draft-slot-empty">
            <div className="draft-slot-label">{label}</div>
            <CoursePicker 
              label="Choose Track" 
              courses={courses} 
              onSelect={onSelect} 
            />
          </div>
        ) : (
          <div className="draft-slot-filled">
            <div className="draft-slot-header">
              <span className="draft-slot-label">{label}</span>
              <button 
                className="draft-slot-remove" 
                onClick={() => onSelect({ id: null })}
              >
                Remove
              </button>
            </div>
            <CourseCard
              course={course}
              isFocused={focusedId === course.id}
              onToggleFocus={(id) => onSetFocusedId(focusedId === id ? null : id)}
              selectedSkills={selectedSkills}
              showSkillsOnMap={showSkillsOnMap}
              showSkillPreviews={showSkillPreviews}
              onToggleSkillPreviews={onToggleSkillPreviews}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="draft-visualiser">
      <div className="draft-header-actions">
        <h2>Draft Visualiser</h2>
        <button className="clear-draft-btn" onClick={clearDraft}>Clear All</button>
      </div>

      <div className={`draft-grid ${isMiddleMinimized ? 'middle-minimized' : ''} ${isHomeMinimized ? 'home-minimized' : ''} ${isOpponentMinimized ? 'opponent-minimized' : ''}`}>
        {/* Home Team Column */}
        <div className={`draft-column home-column ${isHomeMinimized ? 'minimized' : ''}`}>
          <div className="draft-column-header-toggle" onClick={() => setIsHomeMinimized(!isHomeMinimized)}>
            <h3>Home Team</h3>
            <span>{isHomeMinimized ? '▶' : '◀'}</span>
          </div>
          {!isHomeMinimized && draft.home.map((id, i) => (
            renderSlot(id, `Home Map ${i + 1}`, (course) => updateHome(i, course))
          ))}
        </div>

        {/* Tiebreak Column (Center) */}
        <div className={`draft-column tiebreak-column ${isMiddleMinimized ? 'minimized' : ''}`}>
          <div className="tiebreak-header" onClick={() => setIsMiddleMinimized(!isMiddleMinimized)}>
            <h3>Tiebreaker</h3>
            <span>{isMiddleMinimized ? '▶' : '◀'}</span>
          </div>

          {!isMiddleMinimized && (
            <Fragment>
              {renderSlot(draft.tiebreak, 'Tiebreak Map', updateTiebreak)}
              
              <div className={`skill-selector draft-skill-selector ${isSkillPickerExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="skill-selector-header" onClick={() => setIsSkillPickerExpanded(!isSkillPickerExpanded)}>
                  <div className="skill-selector-title-wrap">
                    <span className="skill-selector-chevron">{isSkillPickerExpanded ? '▼' : '▶'}</span>
                    <span className="skill-selector-title">Preview Skill</span>
                    {!isSkillPickerExpanded && selectedSkills.length > 0 && (
                      <span className="skill-selector-count">({selectedSkills.length} selected)</span>
                    )}
                  </div>
                </div>

                {isSkillPickerExpanded && (
                  <Fragment>
                    <SkillPicker
                      skills={skillList}
                      selectedIds={selectedSkillIds}
                      onToggle={onToggleSkill}
                    />

                    {selectedSkills.length > 0 && (
                      <div className="skill-info-container">
                        {selectedSkills.map((skill, idx) => {
                          const trackColor = SKILL_COLORS[idx % SKILL_COLORS.length];

                          return (
                            <SkillPill
                              key={skill.id}
                              id={skill.id}
                              name={skill.name}
                              rarity={skill.rarity}
                              selected={true}
                              onClick={onToggleSkill}
                              suffix={
                                <div className="skill-pill-suffix">
                                  <span className="skill-pill-duration">{(skill.baseDuration / 10000).toFixed(1)}s</span>
                                  <div className="skill-track-indicator" style={{ background: trackColor }} />
                                </div>
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                  </Fragment>
                )}
              </div>
              <div className="tiebreak-spacer" />
            </Fragment>
          )}
        </div>

        {/* Opponent Team Column */}
        <div className={`draft-column opponent-column ${isOpponentMinimized ? 'minimized' : ''}`}>
          <div className="draft-column-header-toggle" onClick={() => setIsOpponentMinimized(!isOpponentMinimized)}>
            <h3>Opponent Team</h3>
            <span>{isOpponentMinimized ? '◀' : '▶'}</span>
          </div>
          {!isOpponentMinimized && draft.opponent.map((id, i) => (
            renderSlot(id, `Opponent Map ${i + 1}`, (course) => updateOpponent(i, course))
          ))}
        </div>
      </div>
    </div>
  );
}
