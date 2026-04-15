import { h } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';

interface CoursePickerProps {
  label: string;
  courses: any[];
  onSelect: (course: any) => void;
  placeholder?: string;
  currentCourseId?: string;
}

export function CoursePicker({
  label,
  courses,
  onSelect,
  placeholder = 'Select a track...',
  currentCourseId
}: CoursePickerProps) {
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
    const searchParts = search.toLowerCase().split(/[;,]/).map(s => s.trim()).filter(Boolean);
    if (searchParts.length === 0) return courses;

    return courses.filter(course => {
      return searchParts.some(part => {
        const tokens = part.split(/\s+/).filter(Boolean);
        return tokens.every(token => course.searchString.includes(token));
      });
    });
  }, [courses, search]);

  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === currentCourseId);
  }, [courses, currentCourseId]);

  return (
    <div className={`course-picker ${isOpen ? 'open' : ''}`} ref={dropdownRef}>
      <div className="course-picker-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className="course-picker-label">{label}:</span>
        <span className={`course-picker-summary ${!selectedCourse ? 'placeholder' : ''}`}>
          {selectedCourse ? selectedCourse.trackName : placeholder}
        </span>
        <span className="course-picker-chevron">▼</span>
      </div>
      
      {isOpen && (
        <div className="course-picker-panel">
          <div className="course-picker-search">
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              autoFocus
            />
          </div>
          <div className="course-picker-list">
            {filtered.map(course => (
              <div 
                key={course.id} 
                className={`course-picker-item ${currentCourseId === course.id ? 'selected' : ''}`}
                onClick={() => {
                  onSelect(course);
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                <div className="course-picker-item-info">
                  <span className="course-picker-item-name">{course.trackName}</span>
                  <span className="course-picker-item-id">ID: {course.id}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="course-picker-empty">No tracks found</div>}
          </div>
        </div>
      )}
    </div>
  );
}
