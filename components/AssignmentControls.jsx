"use client";

// Controls for giving a course to a group or person as required or optional (migration 015).

export const REQUIRED_HINT = (
  <><strong>Required</strong>: must complete. <strong>Optional</strong>: can take.</>
);

// "Required" or "Optional" for one assignment, changed in place.
export function RequiredSelect({ assignment, label, onChange, disabled }) {
  return (
    <select className="tp-input access-required" aria-label={`Required or optional for ${label}`} value={assignment.required ? "required" : "optional"}
      disabled={disabled} onChange={(event) => onChange(assignment, event.target.value === "required")}>
      <option value="required">Required</option>
      <option value="optional">Optional</option>
    </select>
  );
}

export function requiredMessage(required) {
  return required ? "Now required." : "Now optional: they can take it, but don’t have to.";
}
