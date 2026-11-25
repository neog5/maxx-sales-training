"use client";

// Controls for giving a course to a group or person as required or optional (migration 015).

export const REQUIRED_HINT = (
  <><strong>Required</strong>: they must complete it. <strong>Optional</strong>: they can see and take it, but don’t have to.</>
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

// "Add new ones as Required / Optional", shown above a picker.
export function AddAsSelect({ value, onChange }) {
  return (
    <label className="access-add-as">
      <span>Add new ones as</span>
      <select className="tp-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="required">Required</option>
        <option value="optional">Optional</option>
      </select>
    </label>
  );
}

export function requiredMessage(required) {
  return required ? "Now required." : "Now optional: they can take it, but don’t have to.";
}
