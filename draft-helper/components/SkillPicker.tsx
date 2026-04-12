import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { SkillPill } from './SkillPill';

export function SkillPicker({
  skills,
  selectedIds,
  onToggle
}: {
  skills: any[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
            selected={selectedSet.has(skill.id)}
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

