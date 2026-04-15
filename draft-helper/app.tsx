import { render, h, Fragment } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import courseData from './course_data.json';
import trackNames from './tracknames.json';
import staminaResults from './stamina_results.json';
import { Language } from '../components/Language';
import './app.css';

import type { Course } from './types';
import {
  DISTANCE_TYPES,
  ACCEL_TYPES,
  ACCEL_TYPE_COLORS,
  ACCEL_DESCRIPTIONS,
  ALL_ACCEL_TYPES,
  SKILL_COLORS
} from './constants';
import { getAccelerationTypes } from './algorithms/track';
import { buildSkillList } from './algorithms/skill';

import { SkillPill } from './components/SkillPill';
import { SkillPicker } from './components/SkillPicker';
import { MultiSelectDropdown } from './components/MultiSelectDropdown';
import { CourseCard } from './components/CourseCard';
import { DraftVisualiser } from './components/DraftVisualiser';

function App() {
  const [isDrafterOpen, setIsDrafterOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<string[]>(['1', '2']);
  const [distanceFilter, setDistanceFilter] = useState<string[]>(['1', '2', '3', '4']);
  const [accelTypeFilter, setAccelTypeFilter] = useState<string[]>(ALL_ACCEL_TYPES);
  const [raceTrackFilter, setRaceTrackFilter] = useState<string[]>([]);
  const [showSkillsOnMap, setShowSkillsOnMap] = useState<boolean>(true);
  const [showSkillPreviews, setShowSkillPreviews] = useState<boolean>(true);
  const [isSkillPickerExpanded, setIsSkillPickerExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<'id' | 'distance' | 'surface'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<{
    tiebreak: string | null;
    home: (string | null)[];
    opponent: (string | null)[];
  }>({
    tiebreak: null,
    home: [null, null, null, null],
    opponent: [null, null, null, null]
  });

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

      const surfaceStr = course.surface === 1 ? 'Turf' : 'Dirt';
      const distanceTypeStr = DISTANCE_TYPES[course.distanceType as keyof typeof DISTANCE_TYPES];
      const trackName = `${(trackNames as any)[course.raceTrackId]?.[1] || `Track ${course.raceTrackId}`} ${surfaceStr} ${course.distance}m`;

      return {
        id,
        ...course,
        trackName,
        accelTypes: getAccelerationTypes(course),
        // Pre-compute string keys for fast filter matching
        surfaceStr: course.surface.toString(),
        distanceTypeStr: course.distanceType.toString(),
        raceTrackIdStr: course.raceTrackId.toString(),
        searchString: `${id} ${trackName} ${course.distance} ${surfaceStr} ${distanceTypeStr}`.toLowerCase(),
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
      const baseName = (trackNames as any)[c.raceTrackId]?.[1] || `Track ${c.raceTrackId}`;
      tracks.set(c.raceTrackId, baseName);
    });
    return Array.from(tracks.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [mergedCourses]);

  const filteredCourses = useMemo(() => {
    const accelSet = new Set(accelTypeFilter);
    const allAccel = accelTypeFilter.length === ALL_ACCEL_TYPES.length;

    return mergedCourses.filter(course => {
      // Advanced Search Logic: Comma/Semicolon = OR, Space = AND
      const searchParts = search.toLowerCase().split(/[;,]/).map(s => s.trim()).filter(Boolean);
      const matchesSearch = searchParts.length === 0 || searchParts.some(part => {
        const tokens = part.split(/\s+/).filter(Boolean);
        return tokens.every(token => course.searchString.includes(token));
      });

      const matchesSurface = surfaceFilter.includes(course.surfaceStr);
      const matchesDistance = distanceFilter.includes(course.distanceTypeStr);
      const matchesRaceTrack = raceTrackFilter.length === 0 || raceTrackFilter.includes(course.raceTrackIdStr);
      const matchesAccelType = allAccel || course.accelTypes.some(t => accelSet.has(t));

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
      <header className="app-header">
        <h1>5v5 Draft Helper</h1>
        <button 
          className="info-btn" 
          onClick={() => setIsInfoOpen(true)}
          title="App Features & Help"
        >
          i
        </button>
      </header>

      {/* Skill Selector */}
      <div className={`skill-selector ${isSkillPickerExpanded ? 'expanded' : 'collapsed'}`}>
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
              onToggle={handleSkillToggle}
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
                      onClick={handleSkillToggle}
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

      {/* Track List Fragment (Permanent) */}
      <Fragment>
        <div className="controls">
          <div className="controls-row">
            <div className="search-wrap">
              <input
                type="text"
                placeholder="Search Track / Length / ID..."
                className="search-input"
                value={search}
                onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              />
              <div className="search-hint">Use <b>spaces</b> for AND, <b>commas/semicolons</b> for OR (e.g. "tokyo 2000; kyoto")</div>
            </div>
          </div>

          <div className="controls-row">
            <MultiSelectDropdown
              label="Racecourse"
              options={uniqueRaceTracks}
              selectedValues={raceTrackFilter}
              onToggle={(id) => handleFilterClick(id, raceTrackFilter, uniqueRaceTracks.map(t => t[0].toString()), setRaceTrackFilter)}
              onClear={() => setRaceTrackFilter([])}
            />
          </div>

          <div className="controls-row">
            <div className="toggle-group-row">
              <div className="toggle-group-item">
                <div className="toggle-group-label">Distance:</div>
                <div className="toggle-group">
                  {Object.keys(DISTANCE_TYPES).map(id => (
                    <button
                      key={id}
                      className={`toggle-btn ${distanceFilter.includes(id) ? 'active' : ''}`}
                      onClick={() => handleFilterClick(id, distanceFilter, ['1', '2', '3', '4'], setDistanceFilter)}
                      onDblClick={() => handleFilterDblClick(['1', '2', '3', '4'], setDistanceFilter)}
                    >
                      {DISTANCE_TYPES[id as keyof typeof DISTANCE_TYPES]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toggle-group-item">
                <div className="toggle-group-label">Ground Type:</div>
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
            </div>
          </div>

          <div className="controls-row">
            <div className="toggle-group-row">
              <div className="toggle-group-item">
                <div className="toggle-group-label">Accel Type:</div>
                <div className="toggle-group accel-toggle-group">
                  {Object.entries(ACCEL_TYPES).map(([key, label]) => (
                    <button
                      key={key}
                      className={`toggle-btn accel-toggle ${accelTypeFilter.includes(key) ? 'active' : ''}`}
                      title={ACCEL_DESCRIPTIONS[key]}
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

              <div className="toggle-group-item">
                <div className="toggle-group-label">Map View:</div>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${showSkillsOnMap ? 'active' : ''}`}
                    onClick={() => setShowSkillsOnMap(!showSkillsOnMap)}
                  >
                    {showSkillsOnMap ? '✓ Skills' : 'Show Skills'}
                  </button>
                  <button
                    className={`toggle-btn ${showSkillPreviews ? 'active' : ''}`}
                    onClick={() => setShowSkillPreviews(!showSkillPreviews)}
                  >
                    {showSkillPreviews ? '✓ Details' : 'Show Details'}
                  </button>
                </div>
              </div>
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

        <div className="course-grid">
          {sortedCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              isFocused={focusedId === course.id}
              onToggleFocus={toggleFocus}
              selectedSkills={selectedSkills}
              showSkillsOnMap={showSkillsOnMap}
              showSkillPreviews={showSkillPreviews}
              onToggleSkillPreviews={() => setShowSkillPreviews(!showSkillPreviews)}
            />
          ))}
        </div>

        {filteredCourses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            No courses found matching your filters.
          </div>
        )}
      </Fragment>

      {/* Draft Visaliser Overlay */}
      {isDrafterOpen && (
        <div className="draft-overlay">
          <div className="draft-overlay-container">
            <button className="draft-overlay-close" onClick={() => setIsDrafterOpen(false)}>✕</button>
            <DraftVisualiser
              courses={mergedCourses}
              selectedSkills={selectedSkills}
              skillList={skillList}
              selectedSkillIds={selectedSkillIds}
              onToggleSkill={handleSkillToggle}
              showSkillsOnMap={showSkillsOnMap}
              showSkillPreviews={showSkillPreviews}
              onToggleSkillPreviews={() => setShowSkillPreviews(!showSkillPreviews)}
              draft={draft}
              onUpdateDraft={setDraft}
              focusedId={focusedId}
              onSetFocusedId={setFocusedId}
            />
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button 
        className={`fab-drafter ${isDrafterOpen ? 'hidden' : ''}`}
        onClick={() => setIsDrafterOpen(true)}
        title="Open Draft Visualiser"
      >
        Draft 5v5
      </button>

      {/* Course Detail Modal */}
      {focusedId && (
        <div className="course-modal-overlay" onClick={() => setFocusedId(null)}>
          <div className="course-modal-container" onClick={e => e.stopPropagation()}>
            <button className="course-modal-close" onClick={() => setFocusedId(null)}>✕</button>
            {(() => {
              const focusedCourse = mergedCourses.find(c => c.id === focusedId);
              return focusedCourse ? (
                <CourseCard
                  course={focusedCourse}
                  isFocused={true}
                  isModal={true}
                  onToggleFocus={() => setFocusedId(null)}
                  selectedSkills={selectedSkills}
                  showSkillsOnMap={showSkillsOnMap}
                  showSkillPreviews={showSkillPreviews}
                  onToggleSkillPreviews={() => setShowSkillPreviews(!showSkillPreviews)}
                />
              ) : null;
            })()}
          </div>
        </div>
      )}

      <button
        className="back-to-top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Back to Top"
      >
        ▲
      </button>

      {/* Info Modal */}
      {isInfoOpen && (
        <div className="info-modal-overlay" onClick={() => setIsInfoOpen(false)}>
          <div className="info-modal-container" onClick={e => e.stopPropagation()}>
            <button className="info-modal-close" onClick={() => setIsInfoOpen(false)}>✕</button>
            <div className="info-modal-content">
              <h2>App Features & Usage</h2>
              
              <div className="feature-grid">
                <div className="feature-item">
                  <div className="feature-icon">🏟️</div>
                  <div className="feature-details">
                    <h3>Track Database</h3>
                    <p>Explore all 58 racetracks with detailed acceleration analysis and stats.</p>
                    <div className="feature-note">
                      Stamina levels are calculated based on <b>Pace Chaser</b> (Senkou) and <b>End Closer</b> (Ooikomi) strategies 
                      at 1200 Spd, 900 Pow, 500 Gut, 900 Wit (Dist Apt: S), targeting 90% Spurt and 80% Survival on Heavy tracks.
                    </div>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">🔍</div>
                  <div className="feature-details">
                    <h3>Smart Search</h3>
                    <p>Powerful filtering: Use <b>spaces</b> for AND, and <b>commas or semicolons</b> for OR logic.</p>
                    <code>"tokyo 2000; kyoto"</code>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">⚡</div>
                  <div className="feature-details">
                    <h3>Skill Visualisation</h3>
                    <p>Select skills from the picker to see their exact activation regions overlaid on any racetrack map.</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">📋</div>
                  <div className="feature-details">
                    <h3>5v5 Draft Visualiser</h3>
                    <p>Interactive tool to plan team compositions, track assignments, and tiebreaker strategies.</p>
                    <p className="feature-hint">Access via the <b>Draft 5v5</b> button at the bottom of the screen.</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">🎯</div>
                  <div className="feature-details">
                    <h3>Course Focus</h3>
                    <p>Get a full-screen, detailed breakdown of any track by <b>clicking on its card</b> in the grid.</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">🛠️</div>
                  <div className="feature-details">
                    <h3>Advanced Filtering</h3>
                    <p>Precision filters for Surface, Distance Type, Acceleration patterns, and more.</p>
                  </div>
                </div>
              </div>

              <div className="info-modal-footer">
                <button className="footer-close-btn" onClick={() => setIsInfoOpen(false)}>Got it!</button>
              </div>
            </div>
          </div>
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
