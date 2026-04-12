import { h } from 'preact';
import { RARITY_CLASS } from '../constants';
import { getSkillTypeClass } from '../algorithms/skill';
import skillMeta from '../skill_meta.json';

export function SkillPill({ id, name, rarity, onClick, selected, suffix }: {
  id: string;
  name: string;
  rarity: number;
  onClick: (id: string) => void;
  selected: boolean;
  suffix?: any;
}) {
  const iconId = (skillMeta as any)[id]?.iconId;
  const rarityClass = RARITY_CLASS[rarity] || 'umasRarity-white';
  const typeClass = getSkillTypeClass(iconId, rarity);

  return (
    <div
      className={`umasSkillPill ${rarityClass} ${typeClass} ${selected ? 'selected' : ''}`}
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
      <div className="umasSkillPillContent">
        <span className="umasSkillPillName">{name}</span>
        {suffix}
      </div>
    </div>
  );
}
