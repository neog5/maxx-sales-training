"use client";

import { COURSE_ACCESS, COURSE_ACCESS_ORDER } from "@/lib/course-access";

// The three "who can see this course" choices as labelled radio cards.
export default function CourseAccessChoice({ value, onChange, disabled = false, name = "course-access" }) {
  return (
    <div className="access-choice" role="radiogroup" aria-label="Who can see this course">
      {COURSE_ACCESS_ORDER.map((key) => (
        <label key={key} className={`access-choice__option is-${key}${value === key ? " is-selected" : ""}`}>
          <input type="radio" name={name} value={key} checked={value === key} disabled={disabled} onChange={() => onChange(key)} />
          <span>
            <strong>{COURSE_ACCESS[key].label}</strong>
            <small>{COURSE_ACCESS[key].hint}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
