"use client";

import { useEffect, useState } from "react";
import { formatDate, formatDateTime } from "@/lib/format.mjs";

// Renders the UTC date on the server and first client render, then switches to the viewer's local time after mount.
export default function LocalDate({ value, withTime = false }) {
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(true), []);
  const format = withTime ? formatDateTime : formatDate;
  return <time dateTime={new Date(value).toISOString()}>{format(value, { local })}</time>;
}
