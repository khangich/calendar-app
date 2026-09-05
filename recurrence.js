(function (root) {
  "use strict";

  const RECURRENCES = ["none", "daily", "weekly", "monthly", "yearly"];

  // Built-in event types, each with a display label and color. The app keeps
  // its own editable registry (types.json) seeded from this map; unknown or
  // deleted types always fall back to "other".
  const EVENT_TYPES = {
    class:    { label: "Class",    color: "#89b4fa" },
    homework: { label: "Homework", color: "#f9e2af" },
    exam:     { label: "Exam",     color: "#f38ba8" },
    work:     { label: "Work",     color: "#a6e3a1" },
    personal: { label: "Personal", color: "#f5c2e7" },
    other:    { label: "Other",    color: "#a6adc8" },
  };

  // Resolve an event's type id against a registry (id -> {label, color}).
  // Missing or unknown types resolve to "other".
  function typeOf(event, types = EVENT_TYPES) {
    if (event && event.type && types[event.type]) return event.type;
    return "other";
  }

  // Group a time-sorted event list by type: [{ type, label, color, events[] }].
  // Group order follows each type's first (earliest) event; events keep
  // their input order within a group.
  function groupEventsByType(events, types = EVENT_TYPES) {
    const groups = new Map();
    for (const ev of events || []) {
      const t = typeOf(ev, types);
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(ev);
    }
    return [...groups.entries()].map(([type, list]) => ({
      type,
      label: (types[type] && types[type].label) || type,
      color: (types[type] && types[type].color) || EVENT_TYPES.other.color,
      events: list,
    }));
  }

  function parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function toISO(date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  // Effective day-of-month for a recurrence in a given month:
  // an event on the 31st still shows on the last shorter month's day.
  function effectiveDay(startDay, year, monthIndex) {
    return Math.min(startDay, daysInMonth(year, monthIndex));
  }

  // Has the event's repeat run reached its end by `date`?
  // Events either keep repeating forever (repeatEnd "never"/undefined) or
  // stop after their endDate (inclusive).
  function hasEnded(event, date) {
    if (event.repeatEnd !== "until" || !event.endDate) return false;
    return parseDate(event.endDate) < date;
  }

  // Does `event` occur on `date` (Date object)? Recurring events start
  // repeating on their start date and continue forever — or until their
  // end date, when one is set.
  function occursOn(event, date) {
    if (!event || !event.start || !event.title) return false;
    const start = parseDate(event.start);
    if (start > date) return false;
    if (hasEnded(event, date)) return false;

    switch (event.recurrence) {
      case "none":
        return toISO(start) === toISO(date);
      case "daily":
        return true;
      case "weekly":
        if (Array.isArray(event.weekdays) && event.weekdays.length) {
          return event.weekdays.includes(date.getDay());
        }
        return start.getDay() === date.getDay();
      case "monthly": {
        const day = effectiveDay(start.getDate(), date.getFullYear(), date.getMonth());
        return date.getDate() === day;
      }
      case "yearly": {
        if (start.getMonth() !== date.getMonth()) return false;
        const day = effectiveDay(start.getDate(), date.getFullYear(), date.getMonth());
        return date.getDate() === day;
      }
      default:
        return false;
    }
  }

  // All events occurring on a specific date. All-day events come first,
  // then timed events ordered by start time (stable for ties).
  function eventsOn(events, date) {
    return events
      .filter((e) => occursOn(e, date))
      .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
  }

  // "16:30" -> "4:30 PM"; anything else -> "".
  function formatTime(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
    if (!m) return "";
    const h = Number(m[1]);
    const mins = Number(m[2]);
    if (h > 23 || mins > 59) return "";
    const ampm = h < 12 ? "AM" : "PM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${m[2]} ${ampm}`;
  }

  // Human-readable time span for an event, e.g. "4:30 PM – 6:30 PM".
  // "" means all-day (no start time set).
  function timeRange(ev) {
    if (!ev || !ev.startTime) return "";
    const start = formatTime(ev.startTime);
    return ev.endTime ? `${start} – ${formatTime(ev.endTime)}` : start;
  }

  // Map of ISO-date -> events[] for the visible month grid.
  function expandMonth(events, year, monthIndex) {
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    const map = {};
    for (const ev of events) {
      const start = parseDate(ev.start);
      const from = start < first ? first : start;
      for (let d = new Date(from); d <= last; d.setDate(d.getDate() + 1)) {
        if (occursOn(ev, d)) {
          const key = toISO(d);
          (map[key] = map[key] || []).push(ev);
        }
      }
    }
    return map;
  }

  const api = { RECURRENCES, EVENT_TYPES, typeOf, groupEventsByType, occursOn, hasEnded, eventsOn, expandMonth, parseDate, toISO, daysInMonth, formatTime, timeRange };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Recurrence = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
