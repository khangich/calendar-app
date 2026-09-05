const { describe, it } = require("node:test");
const assert = require("node:assert");
const { occursOn, expandMonth, daysInMonth, formatTime, timeRange, eventsOn, groupEventsByType, typeOf, EVENT_TYPES } = require("../recurrence.js");

const d = (iso) => {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
};

describe("one-time events", () => {
  const ev = { title: "Party", start: "2026-08-25", recurrence: "none" };
  it("occurs only on its start date", () => {
    assert.ok(occursOn(ev, d("2026-08-25")));
    assert.ok(!occursOn(ev, d("2026-08-26")));
    assert.ok(!occursOn(ev, d("2027-08-25")));
  });
});

describe("weekly events", () => {
  // 2026-08-25 is a Tuesday
  const ev = { title: "Standup", start: "2026-08-25", recurrence: "weekly" };
  it("repeats every 7 days after start", () => {
    assert.ok(occursOn(ev, d("2026-09-01")));
    assert.ok(occursOn(ev, d("2026-12-29")));
    assert.ok(occursOn(ev, d("2027-06-15")));
  });
  it("does not occur on other weekdays or before start", () => {
    assert.ok(!occursOn(ev, d("2026-09-02")));
    assert.ok(!occursOn(ev, d("2026-08-18")));
  });
});

describe("weekly events with multiple weekdays", () => {
  // 2026-08-25 is a Tuesday
  const ev = { title: "Practice", start: "2026-08-25", recurrence: "weekly", weekdays: [1, 3, 5] }; // Mon, Wed, Fri
  it("occurs on each chosen weekday", () => {
    assert.ok(occursOn(ev, d("2026-08-26"))); // Wed
    assert.ok(occursOn(ev, d("2026-08-28"))); // Fri
    assert.ok(occursOn(ev, d("2026-08-31"))); // Mon
  });
  it("does not occur on unchosen weekdays", () => {
    assert.ok(!occursOn(ev, d("2026-08-25"))); // Tue (start), not selected
    assert.ok(!occursOn(ev, d("2026-08-27")));
  });
  it("does not occur before the start date", () => {
    assert.ok(!occursOn(ev, d("2026-08-24"))); // Mon before start
  });
  it("falls back to the start weekday without weekdays", () => {
    const ev2 = { title: "Standup", start: "2026-08-25", recurrence: "weekly" };
    assert.ok(occursOn(ev2, d("2026-09-01")));
    assert.ok(!occursOn(ev2, d("2026-08-26")));
  });
  it("respects the end date with multiple weekdays", () => {
    const bounded = { ...ev, repeatEnd: "until", endDate: "2026-09-02" };
    assert.ok(occursOn(bounded, d("2026-09-02"))); // Wed
    assert.ok(!occursOn(bounded, d("2026-09-04"))); // Fri
  });
});

describe("monthly events", () => {
  const ev = { title: "Rent", start: "2026-01-31", recurrence: "monthly" };
  it("repeats on same day each month", () => {
    assert.ok(occursOn(ev, d("2026-03-31")));
    assert.ok(occursOn(ev, d("2027-07-31")));
  });
  it("clamps to month end for short months (Jan 31 -> Feb 28)", () => {
    assert.ok(occursOn(ev, d("2026-02-28")));
    assert.ok(!occursOn(ev, d("2026-02-27")));
  });
  it("does not occur before start", () => {
    assert.ok(!occursOn(ev, d("2025-12-31")));
  });
});

describe("yearly events", () => {
  const ev = { title: "Birthday", start: "2024-02-29", recurrence: "yearly" };
  it("repeats on same date each year", () => {
    assert.ok(occursOn(ev, d("2025-02-28"))); // clamp in non-leap year
    assert.ok(occursOn(ev, d("2028-02-29")));
  });
  it("does not occur on wrong month/day or before start", () => {
    assert.ok(!occursOn(ev, d("2025-03-01")));
    assert.ok(!occursOn(ev, d("2023-02-28")));
  });
});

describe("daily events", () => {
  const ev = { title: "Meds", start: "2026-08-25", recurrence: "daily" };
  it("occurs every day after start, including the start day", () => {
    assert.ok(occursOn(ev, d("2026-08-25")));
    assert.ok(occursOn(ev, d("2026-08-26")));
    assert.ok(occursOn(ev, d("2027-06-15")));
  });
  it("does not occur before start", () => {
    assert.ok(!occursOn(ev, d("2026-08-24")));
  });
});

describe("repeats that end", () => {
  const ev = {
    title: "Course",
    start: "2026-09-01",
    recurrence: "weekly",
    repeatEnd: "until",
    endDate: "2026-10-06",
  };
  it("occurs up to and including the end date", () => {
    assert.ok(occursOn(ev, d("2026-09-01")));
    assert.ok(occursOn(ev, d("2026-09-29")));
    assert.ok(occursOn(ev, d("2026-10-06"))); // end date is inclusive
  });
  it("does not occur after the end date", () => {
    assert.ok(!occursOn(ev, d("2026-10-13")));
    assert.ok(!occursOn(ev, d("2027-01-05")));
  });

  const daily = {
    title: "Challenge",
    start: "2026-08-01",
    recurrence: "daily",
    repeatEnd: "until",
    endDate: "2026-08-07",
  };
  it("also bounds daily repeats", () => {
    assert.ok(occursOn(daily, d("2026-08-07")));
    assert.ok(!occursOn(daily, d("2026-08-08")));
  });

  it("ended events do not show up in later month expansions", () => {
    const map = expandMonth([ev], 2026, 11); // December
    assert.equal(map["2026-12-01"], undefined);
  });
});

describe("legacy events without an end field keep repeating forever", () => {
  const ev = { title: "Old standup", start: "2020-01-06", recurrence: "weekly" };
  it("still occurs far in the future", () => {
    assert.ok(occursOn(ev, d("2035-12-31")));
    assert.ok(!ev.repeatEnd);
  });
});

describe("expandMonth", () => {
  it("maps dates to their events within the grid", () => {
    const events = [
      { id: "1", title: "A", start: "2026-08-10", recurrence: "none" },
      { id: "2", title: "B", start: "2026-08-05", recurrence: "weekly" },
    ];
    const map = expandMonth(events, 2026, 7); // August
    assert.deepEqual(map["2026-08-10"].map((e) => e.id), ["1"]);
    assert.ok(map["2026-08-05"].some((e) => e.id === "2"));
    assert.ok(map["2026-08-12"].some((e) => e.id === "2"));
    assert.equal(map["2026-08-13"], undefined);
  });
});

describe("daysInMonth", () => {
  it("handles leap years", () => {
    assert.equal(daysInMonth(2024, 1), 29);
    assert.equal(daysInMonth(2026, 1), 28);
    assert.equal(daysInMonth(2026, 11), 31);
  });
});

describe("formatTime", () => {
  it("renders 24-hour times as 12-hour with AM/PM", () => {
    assert.equal(formatTime("16:30"), "4:30 PM");
    assert.equal(formatTime("08:00"), "8:00 AM");
    assert.equal(formatTime("00:15"), "12:15 AM");
    assert.equal(formatTime("12:00"), "12:00 PM");
  });
  it("returns empty for missing or malformed times", () => {
    assert.equal(formatTime(""), "");
    assert.equal(formatTime(undefined), "");
    assert.equal(formatTime("25:99"), "");
  });
});

describe("timeRange", () => {
  it("joins start and end times", () => {
    assert.equal(timeRange({ startTime: "16:30", endTime: "18:30" }), "4:30 PM – 6:30 PM");
  });
  it("falls back to the start time alone", () => {
    assert.equal(timeRange({ startTime: "09:00" }), "9:00 AM");
  });
  it("treats events without a time as all-day", () => {
    assert.equal(timeRange({}), "");
    assert.equal(timeRange({ startTime: "", endTime: "18:30" }), "");
  });
});

describe("eventsOn ordering", () => {
  it("lists all-day events first, then timed events by start time", () => {
    const events = [
      { id: "timed", title: "Class", start: "2026-08-27", startTime: "16:30", endTime: "18:30", recurrence: "none" },
      { id: "allday", title: "All-day", start: "2026-08-27", recurrence: "none" },
      { id: "earlier", title: "Breakfast", start: "2026-08-27", startTime: "07:45", recurrence: "none" },
    ];
    const list = eventsOn(events, d("2026-08-27"));
    assert.deepEqual(list.map((e) => e.id), ["allday", "earlier", "timed"]);
  });
});

describe("groupEventsByType", () => {
  it("groups a time-sorted list by type, keeping order inside groups", () => {
    const events = [
      { id: "1", title: "Algebra", start: "2026-08-27", startTime: "16:30", type: "class", recurrence: "none" },
      { id: "2", title: "Chores", start: "2026-08-27", startTime: "17:00", type: "personal", recurrence: "none" },
      { id: "3", title: "Study", start: "2026-08-27", startTime: "19:00", type: "class", recurrence: "none" },
    ];
    const groups = groupEventsByType(events);
    assert.deepEqual(groups.map((g) => g.type), ["class", "personal"]);
    assert.deepEqual(groups[0].events.map((e) => e.id), ["1", "3"]);
    assert.equal(groups[0].color, EVENT_TYPES.class.color);
    assert.equal(groups[0].label, "Class");
  });

  it("falls back to 'other' for unknown or missing types", () => {
    const groups = groupEventsByType([
      { id: "1", title: "A", start: "2026-08-27", type: "alien", recurrence: "none" },
      { id: "2", title: "B", start: "2026-08-27", recurrence: "none" },
    ]);
    assert.deepEqual(groups.map((g) => g.type), ["other"]);
    assert.equal(groups[0].color, EVENT_TYPES.other.color);
    assert.equal(groups[0].events.length, 2);
  });

  it("handles empty input", () => {
    assert.deepEqual(groupEventsByType([]), []);
  });
});

describe("custom type registries", () => {
  const registry = {
    cs:      { label: "CS",      color: "#010203" },
    sports:  { label: "Sports",  color: "#040506" },
    other:   { label: "Other",   color: "#070809" },
  };

  it("typeOf resolves against the registry", () => {
    assert.equal(typeOf({ type: "cs" }, registry), "cs");
    assert.equal(typeOf({ type: "sports" }, registry), "sports");
  });
  it("typeOf falls back to 'other' for unknown or missing types", () => {
    assert.equal(typeOf({ type: "ghost" }, registry), "other");
    assert.equal(typeOf({}, registry), "other");
    assert.equal(typeOf(null, registry), "other");
  });
  it("typeOf defaults to the built-ins when no registry is given", () => {
    assert.equal(typeOf({ type: "class" }), "class");
    assert.equal(typeOf({ type: "nope" }), "other");
  });
  it("groupEventsByType labels and colors from the registry", () => {
    const groups = groupEventsByType([
      { id: "1", title: "A", start: "2026-08-27", type: "cs", recurrence: "none" },
      { id: "2", title: "B", start: "2026-08-27", type: "ghost", recurrence: "none" },
    ], registry);
    assert.deepEqual(groups.map((g) => g.type), ["cs", "other"]);
    assert.equal(groups[0].label, "CS");
    assert.equal(groups[0].color, "#010203");
    assert.equal(groups[1].label, "Other");
    assert.equal(groups[1].color, "#070809");
  });
});
