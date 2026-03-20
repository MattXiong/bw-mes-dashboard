"use client";

import { useEffect, useMemo, useState } from "react";

function formatBoardDateTime(d: Date) {
  const year = d.getFullYear();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ] as const;
  const monthName = monthNames[d.getMonth()] ?? "Unknown";
  const day = d.getDate();
  const hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, "0");
  // Target format: March 20. 2026. 13 : 31
  return `${monthName} ${day}. ${year}. ${hour}:${minute}`;
}

export function BoardClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const text = useMemo(() => formatBoardDateTime(now), [now]);

  return (
    <div
      className="tabular-nums text-[clamp(1.125rem,2.2vw,2.5rem)] font-semibold tracking-tight"
      style={{
        fontFamily: "'Consolas','Courier New',monospace",
        color: "#00e5ff",
        textShadow:
          "0 0 14px rgba(0, 229, 255, 0.55), 0 0 3px rgba(0, 229, 255, 0.35)",
      }}
    >
      {text}
    </div>
  );
}

