"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatDateTime } from "@/lib/format";

const subscribe = () => () => {};

// Renders the UTC date on the server and during hydration, then the viewer's local time.
export default function LocalDate({ value, withTime = false }) {
  const local = useSyncExternalStore(subscribe, () => true, () => false);
  const format = withTime ? formatDateTime : formatDate;
  return <time dateTime={new Date(value).toISOString()}>{format(value, { local })}</time>;
}
