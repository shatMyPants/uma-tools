import { h } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';

export function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onToggle,
  onClear
}: {
  label: string;
  options: [number, string][];
  selectedValues: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return options.filter(([id, name]) => name.toLowerCase().includes(q));
  }, [options, search]);

  const summary = useMemo(() => {
    if (selectedValues.length === 0) return 'All';
    if (selectedValues.length === 1) {
      const opt = options.find(([id]) => id.toString() === selectedValues[0]);
      return opt ? opt[1] : '1 selected';
    }
    return `${selectedValues.length} selected`;
  }, [selectedValues, options]);

  return (
    <div className={`multi-dropdown ${isOpen ? 'open' : ''}`} ref={dropdownRef}>
      <div className="multi-dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className="multi-dropdown-label">{label}:</span>
        <span className="multi-dropdown-summary">{summary}</span>
        <span className="multi-dropdown-chevron">▼</span>
      </div>
      {isOpen && (
        <div className="multi-dropdown-panel">
          <div className="multi-dropdown-search">
            <input
              type="text"
              placeholder="Filter tracks..."
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              autoFocus
            />
          </div>
          <div className="multi-dropdown-actions">
            <button onClick={onClear}>Clear All</button>
            <button onClick={() => setIsOpen(false)}>Close</button>
          </div>
          <div className="multi-dropdown-list">
            {filtered.map(([id, name]) => {
              const sId = id.toString();
              const isSelected = selectedValues.includes(sId);
              return (
                <label key={sId} className={`multi-dropdown-item ${isSelected ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(sId)}
                  />
                  <span>{name}</span>
                </label>
              );
            })}
            {filtered.length === 0 && <div className="multi-dropdown-empty">No tracks found</div>}
          </div>
        </div>
      )}
    </div>
  );
}
