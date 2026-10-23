// Dates default to UTC so server-rendered and hydrated client text always match.
// Pass { local: true } only after mount (see components/LocalDate.jsx) to use the viewer's time zone.
function zone(local) {
  return local ? {} : { timeZone: "UTC" };
}

export function formatDate(value, { local = false } = {}) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", ...zone(local) }).format(new Date(value));
}

export function formatDateTime(value, { local = false } = {}) {
  const text = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", ...zone(local) }).format(new Date(value));
  return local ? text : `${text} UTC`;
}

// YYYY-MM-DD in the viewer's local time zone, for file names.
export function localDateStamp(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
}
