"use strict";

const grid = document.getElementById("grid");
const monthLabel = document.getElementById("monthLabel");
const dayTitle = document.getElementById("dayTitle");
const dayEventsEl = document.getElementById("dayEvents");
const dayEmptyEl = document.getElementById("dayEmpty");
const addForDayBtn = document.getElementById("addForDayBtn");
const dataNote = document.getElementById("dataNote");

const editor = document.getElementById("editor");
const editorHeading = document.getElementById("editorHeading");
const editorForm = document.getElementById("editorForm");
const fTitle = document.getElementById("fTitle");
const fType = document.getElementById("fType");
const fDate = document.getElementById("fDate");
const fStartTime = document.getElementById("fStartTime");
const fEndTime = document.getElementById("fEndTime");
const fRecurrence = document.getElementById("fRecurrence");
const endRow = document.getElementById("endRow");
const fEndMode = document.getElementById("fEndMode");
const endDateLabel = document.getElementById("endDateLabel");
const fEndDate = document.getElementById("fEndDate");
const recurrenceHint = document.getElementById("recurrenceHint");
const deleteBtn = document.getElementById("deleteBtn");
const cancelBtn = document.getElementById("cancelBtn");

const typeManager = document.getElementById("typeManager");
const typeList = document.getElementById("typeList");
const newTypeName = document.getElementById("newTypeName");
const newTypeColor = document.getElementById("newTypeColor");
const addTypeBtn = document.getElementById("addTypeBtn");
const closeTypesBtn = document.getElementById("closeTypesBtn");
const manageTypesBtn = document.getElementById("manageTypesBtn");
const typeToggleList = document.getElementById("typeToggleList");
const sidebarManageBtn = document.getElementById("sidebarManageBtn");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");

const { occursOn, eventsOn, parseDate, toISO, formatTime, timeRange, EVENT_TYPES, groupEventsByType } = window.Recurrence;

const RECURRENCE_LABELS = {
  none: "one-time",
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const weekdayRow = document.getElementById("weekdayRow");

let events = [];
let types = [];                    // editable registry: [{ id, label, color }]
let hiddenTypes = new Set(JSON.parse(localStorage.getItem("hiddenTypes") || "[]"));
let viewYear, viewMonth;          // displayed month
let selectedISO = toISO(new Date());
let editingId = null;             // event id open in the dialog
let searchQuery = "";

/* ---------- type registry ---------- */

const typeMap = () => Object.fromEntries(types.map((t) => [t.id, t]));

// The event's type, or the permanent "other" fallback.
function typeById(id) {
  return types.find((t) => t.id === id) || types.find((t) => t.id === "other");
}

function resolvedTypeId(ev) {
  return types.some((t) => t.id === ev.type) ? ev.type : "other";
}

function saveHiddenTypes() {
  localStorage.setItem("hiddenTypes", JSON.stringify([...hiddenTypes]));
}

function matchesSearch(ev) {
  if (!searchQuery) return true;
  return ev.title.toLowerCase().includes(searchQuery.toLowerCase());
}

// Events whose type isn't hidden in the left sidebar and match search.
function visibleEvents() {
  return events.filter((e) => !hiddenTypes.has(resolvedTypeId(e)) && matchesSearch(e));
}

function updateSearchUI() {
  searchClear.classList.toggle("hidden", !searchQuery);
}

async function persistTypes() {
  await window.api.saveTypes(types);
}

function populateTypeSelect() {
  const current = fType.value;
  fType.textContent = "";
  for (const t of types) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.label;
    fType.appendChild(opt);
  }
  fType.value = types.some((t) => t.id === current) ? current : "other";
}

/* ---------- persistence ---------- */

async function persist() {
  await window.api.saveEvents(events);
}

/* ---------- rendering ---------- */

function render() {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  monthLabel.textContent = `${monthNames[viewMonth]} ${viewYear}`;
  renderGrid();
  renderDayPane();
}

function renderGrid() {
  const todayISO = toISO(new Date());
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday-first
  const gridStart = new Date(viewYear, viewMonth, 1 - firstDow);

  grid.textContent = "";
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const iso = toISO(date);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (date.getMonth() !== viewMonth) cell.classList.add("other-month");
    if (iso === todayISO) cell.classList.add("today");
    if (iso === selectedISO) cell.classList.add("selected");
    if (date.getDay() === 0 || date.getDay() === 6) cell.classList.add("weekend");

    const num = document.createElement("span");
    num.className = "day-num";
    num.textContent = date.getDate();
    cell.appendChild(num);

    if (date.getMonth() === viewMonth) {
      const dayEvents = eventsOn(visibleEvents(), date);
      if (dayEvents.length > 0) {
        const chips = document.createElement("span");
        chips.className = "event-chips";
        for (const ev of dayEvents.slice(0, 3)) {
          const chip = document.createElement("span");
          chip.className = "chip" + (ev.recurrence !== "none" ? " recurring" : "");
          chip.textContent = (ev.startTime ? formatTime(ev.startTime) + " \u00b7 " : "") + ev.title;
          const color = typeById(ev.type)?.color || EVENT_TYPES.other.color;
          chip.style.color = color;
          chip.style.background = color + "22"; // faint tint of the type color
          chips.appendChild(chip);
        }
        if (dayEvents.length > 3) {
          const more = document.createElement("span");
          more.className = "chip";
          more.textContent = `+${dayEvents.length - 3} more`;
          chips.appendChild(more);
        }
        cell.appendChild(chips);
      }
      cell.title =
        `${date.toDateString()}\n` +
        (dayEvents.length
          ? dayEvents
              .map((e) => {
                const time = timeRange(e);
                return `\u2022 ${e.title}${time ? ` (${time})` : ""} (${RECURRENCE_LABELS[e.recurrence]})`;
              })
              .join("\n")
          : "Click to add an event");
    }

    cell.addEventListener("click", () => {
      selectedISO = iso;
      if (date.getMonth() !== viewMonth) {
        // Clicking a leading/trailing grid cell jumps to that month.
        viewYear = date.getFullYear();
        viewMonth = date.getMonth();
      }
      render();
    });
    cell.addEventListener("dblclick", () => openEditor(null, iso));

    grid.appendChild(cell);
  }
}

function renderDayPane() {
  const date = parseDate(selectedISO);
  dayTitle.textContent = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const groups = groupEventsByType(eventsOn(visibleEvents(), date), typeMap());
  dayEventsEl.textContent = "";
  dayEmptyEl.classList.toggle("hidden", groups.length > 0);

  for (const group of groups) {
    const header = document.createElement("li");
    header.className = "group-header";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = group.color;
    const label = document.createElement("span");
    label.textContent = group.label;
    header.append(dot, label);
    dayEventsEl.appendChild(header);

    for (const ev of group.events) {
      const li = document.createElement("li");
      li.className = "event-item";
      li.style.borderLeftColor = group.color;

      const time = timeRange(ev);
      const title = document.createElement("span");
      title.className = "title";
      title.textContent = time ? `${ev.title} · ${time}` : ev.title;
      title.title =
        `Starts ${ev.start}` +
        (time ? ` at ${time}` : "") +
        (ev.recurrence !== "none" && ev.repeatEnd === "until" && ev.endDate
          ? `, last one on ${ev.endDate}`
          : ev.recurrence !== "none"
            ? ", repeats forever"
            : "");
      li.appendChild(title);

      if (ev.recurrence !== "none") {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = RECURRENCE_LABELS[ev.recurrence];
        li.appendChild(badge);
      }

      const editBtn = document.createElement("button");
      editBtn.textContent = "\u270E";
      editBtn.title = "Edit";
      editBtn.addEventListener("click", () => openEditor(ev.id));
      li.appendChild(editBtn);

      li.addEventListener("dblclick", () => openEditor(ev.id));

      dayEventsEl.appendChild(li);
    }
  }
}

/* ---------- editor dialog ---------- */

function updateRecurrenceHint() {
  const r = fRecurrence.value;
  const d = parseDate(fDate.value || toISO(new Date()));
  const fmt = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const repeating = r !== "none";
  endRow.classList.toggle("hidden", !repeating);
  weekdayRow.classList.toggle("hidden", r !== "weekly");

  if (r === "weekly") {
    const days = selectedWeekdays();
    const startDay = d.getDay();
    if (days.length === 0) {
      setWeekdays([startDay]);
    }
  }

  const hints = {
    none: "",
    daily: "Repeats every day.",
    weekly: weeklyHint(d),
    monthly: `Repeats on the ${ordinal(d.getDate())} of each month.`,
    yearly: `Repeats every year on ${fmt}.`,
  };

  if (fEndMode.value === "until") {
    endDateLabel.classList.remove("hidden");
    fEndDate.min = fDate.value;
    if (fEndDate.value && fEndDate.value < fDate.value) fEndDate.value = fDate.value;
  } else {
    endDateLabel.classList.add("hidden");
  }

  let hint = `${timeHint()}. ${hints[r] ?? ""}`.replace(/\s+/g, " ").trim();
  if (repeating && fEndMode.value === "until" && fEndDate.value) {
    const end = parseDate(fEndDate.value);
    hint += ` Last one: ${end.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}.`;
  } else if (repeating) {
    hint += " Continues forever.";
  }
  recurrenceHint.textContent = hint;
}

function weeklyHint(date) {
  const days = selectedWeekdays();
  if (days.length === 0) return "";
  const names = days.map(day => WEEKDAY_NAMES[day]);
  if (days.length === 1) {
    return `Repeats every ${names[0]}.`;
  }
  if (days.length === 2) {
    return `Repeats every ${names[0]} and ${names[1]}.`;
  }
  return `Repeats every week on ${names.slice(0, -1).join(", ")}, and ${names.at(-1)}.`;
}

// "4:30 PM – 6:30 PM", "4:30 PM" or "All day" for the dialog hint line.
function timeHint() {
  if (!fStartTime.value) return "All day";
  return fEndTime.value
    ? `${formatTime(fStartTime.value)} – ${formatTime(fEndTime.value)}`
    : formatTime(fStartTime.value);
}

// "16:30" + 2h -> "18:30", clamped to the last minute of the day.
function plusHours(hhmm, hours) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.min(h * 60 + m + hours * 60, 23 * 60 + 59);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 60))}:${p(t % 60)}`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function openEditor(eventId, isoForNew) {
  editingId = eventId;
  const existing = eventId ? events.find((e) => e.id === eventId) : null;

  editorHeading.textContent = existing ? "Edit event" : "New event";
  fTitle.value = existing ? existing.title : "";
  fType.value = existing && types.some((t) => t.id === existing.type) ? existing.type : "other";
  fDate.value = existing ? existing.start : isoForNew || selectedISO;
  fStartTime.value = (existing && existing.startTime) || "";
  fEndTime.value = (existing && existing.endTime) || "";
  fRecurrence.value = existing ? existing.recurrence : "none";
  fEndMode.value = existing && existing.repeatEnd === "until" ? "until" : "never";
  fEndDate.value = (existing && existing.endDate) || fDate.value;
  deleteBtn.classList.toggle("hidden", !existing);

  if (existing && existing.recurrence === "weekly" && Array.isArray(existing.weekdays) && existing.weekdays.length) {
    setWeekdays(existing.weekdays);
  } else {
    const startDay = parseDate(fDate.value || toISO(new Date())).getDay();
    setWeekdays([startDay]);
  }

  updateRecurrenceHint();

  editor.showModal();
  fTitle.focus();
}

editorForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = fTitle.value.trim();
  if (!title) return;

  const recurrence = fRecurrence.value;
  const endsOnDate = recurrence !== "none" && fEndMode.value === "until" && fEndDate.value;

  const startTime = fStartTime.value || undefined;
  const endTime = fEndTime.value || undefined;
  if (startTime && endTime && endTime <= startTime) {
    alert("End time must be after the start time.");
    fEndTime.focus();
    return;
  }

  let weekdays;
  if (recurrence === "weekly") {
    const days = selectedWeekdays();
    if (days.length === 0) {
      const startDay = parseDate(fDate.value || toISO(new Date())).getDay();
      weekdays = [startDay];
    } else {
      weekdays = days;
    }
  }

  const changes = {
    title,
    type: typeById(fType.value) ? fType.value : "other",
    start: fDate.value,
    startTime,
    endTime: startTime ? endTime : undefined,
    recurrence,
    repeatEnd: endsOnDate ? "until" : undefined,
    endDate: endsOnDate ? fEndDate.value : undefined,
    weekdays: recurrence === "weekly" ? weekdays : undefined,
  };

  if (editingId) {
    const ev = events.find((x) => x.id === editingId);
    Object.assign(ev, changes);
  } else {
    events.push({ id: crypto.randomUUID(), ...changes });
  }

  await persist();
  editor.close();
  render();
});

deleteBtn.addEventListener("click", async () => {
  const ev = events.find((e) => e.id === editingId);
  const scope =
    ev && ev.recurrence !== "none"
      ? `Delete "${ev.title}" and all its future repeats?`
      : "Delete this event?";
  if (!confirm(scope)) return;
  events = events.filter((e) => e.id !== editingId);
  await persist();
  editor.close();
  render();
});

cancelBtn.addEventListener("click", () => editor.close());

function selectedWeekdays() {
  const days = [];
  for (const btn of weekdayRow.querySelectorAll(".weekday-btn")) {
    if (btn.classList.contains("on")) days.push(Number(btn.dataset.day));
  }
  return days.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
}

function setWeekdays(days) {
  const set = new Set(days || []);
  for (const btn of weekdayRow.querySelectorAll(".weekday-btn")) {
    btn.classList.toggle("on", set.has(Number(btn.dataset.day)));
  }
}

for (const btn of weekdayRow.querySelectorAll(".weekday-btn")) {
  btn.addEventListener("click", () => {
    btn.classList.toggle("on");
    updateRecurrenceHint();
  });
}

fRecurrence.addEventListener("change", () => {
  if (fRecurrence.value === "weekly" && selectedWeekdays().length === 0) {
    const startDay = parseDate(fDate.value || toISO(new Date())).getDay();
    setWeekdays([startDay]);
  }
  updateRecurrenceHint();
});
fDate.addEventListener("change", () => {
  if (fRecurrence.value === "weekly" && selectedWeekdays().length === 0) {
    const startDay = parseDate(fDate.value || toISO(new Date())).getDay();
    setWeekdays([startDay]);
  }
  updateRecurrenceHint();
});
fStartTime.addEventListener("change", () => {
  // Picking a start time with no end time suggests a 2-hour block (e.g. 4:30 – 6:30).
  if (fStartTime.value && !fEndTime.value) fEndTime.value = plusHours(fStartTime.value, 2);
  updateRecurrenceHint();
});
fEndTime.addEventListener("change", updateRecurrenceHint);
fEndMode.addEventListener("change", () => {
  // Default the end date to the start date so "until" is always valid.
  if (fEndMode.value === "until" && !fEndDate.value) fEndDate.value = fDate.value;
  updateRecurrenceHint();
});
fEndDate.addEventListener("change", updateRecurrenceHint);

/* ---------- left type sidebar (show/hide) ---------- */

function renderTypeSidebar() {
  typeToggleList.textContent = "";
  for (const t of types) {
    const hidden = hiddenTypes.has(t.id);
    const li = document.createElement("li");
    li.className = "type-toggle" + (hidden ? " off" : "");
    li.title = hidden ? `Show "${t.label}"` : `Hide "${t.label}"`;

    const box = document.createElement("span");
    box.className = "toggle-box";
    if (!hidden) {
      box.style.borderColor = t.color;
      box.style.background = t.color;
    }

    const label = document.createElement("span");
    label.className = "toggle-label";
    label.textContent = t.label;

    li.append(box, label);
    li.addEventListener("click", () => {
      if (hiddenTypes.has(t.id)) hiddenTypes.delete(t.id);
      else hiddenTypes.add(t.id);
      saveHiddenTypes();
      renderTypeSidebar();
      render();
    });
    typeToggleList.appendChild(li);
  }
}

/* ---------- type manager dialog ---------- */

function renderTypeManager() {
  typeList.textContent = "";
  for (const t of types) {
    const li = document.createElement("li");
    li.className = "type-row";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = t.color;
    colorInput.title = "Change color";
    colorInput.className = "type-color-input";
    colorInput.addEventListener("input", async () => {
      t.color = colorInput.value;
      await persistTypes();
      renderTypeSidebar();
      populateTypeSelect();
      render();
    });
    li.appendChild(colorInput);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = t.label;
    nameInput.maxLength = 24;
    nameInput.className = "type-name-input";
    if (t.id === "other") nameInput.title = "Fallback type — rename allowed, cannot delete";
    const saveName = async () => {
      const newLabel = nameInput.value.trim();
      if (!newLabel) {
        nameInput.value = t.label;
        return;
      }
      if (newLabel !== t.label && types.some((x) => x.id !== t.id && x.label.toLowerCase() === newLabel.toLowerCase())) {
        alert(`A type named "${newLabel}" already exists.`);
        nameInput.value = t.label;
        nameInput.focus();
        return;
      }
      if (newLabel !== t.label) {
        t.label = newLabel;
        await persistTypes();
        populateTypeSelect();
        renderTypeSidebar();
        render();
        renderTypeManager();
      }
    };
    nameInput.addEventListener("change", saveName);
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameInput.blur();
      }
    });
    li.appendChild(nameInput);

    if (t.id === "other") {
      li.title = "Fallback type — always available";
    } else {
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "\u2715";
      del.title = "Delete type";
      del.addEventListener("click", async () => {
        const inUse = events.some((e) => e.type === t.id);
        const msg = inUse
          ? `Delete "${t.label}"? Events using it will become Other.`
          : `Delete type "${t.label}"?`;
        if (!confirm(msg)) return;
        types = types.filter((x) => x.id !== t.id);
        hiddenTypes.delete(t.id);
        saveHiddenTypes();
        await persistTypes();
        renderTypeManager();
        populateTypeSelect();
        renderTypeSidebar();
        render();
      });
      li.appendChild(del);
    }

    typeList.appendChild(li);
  }
}

addTypeBtn.addEventListener("click", async () => {
  const label = newTypeName.value.trim();
  if (!label) {
    newTypeName.focus();
    return;
  }
  if (types.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
    alert(`A type named "${label}" already exists.`);
    return;
  }
  types = [...types, { id: crypto.randomUUID(), label, color: newTypeColor.value }];
  newTypeName.value = "";
  await persistTypes();
  renderTypeManager();
  populateTypeSelect();
  renderTypeSidebar();
  newTypeName.focus();
});

newTypeName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTypeBtn.click();
  }
});

function openTypeManager() {
  renderTypeManager();
  typeManager.showModal();
  newTypeName.focus();
}
manageTypesBtn.addEventListener("click", openTypeManager);
sidebarManageBtn.addEventListener("click", openTypeManager);
closeTypesBtn.addEventListener("click", () => typeManager.close());

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim();
  updateSearchUI();
  render();
});

searchClear.addEventListener("click", () => {
  searchQuery = "";
  searchInput.value = "";
  updateSearchUI();
  render();
  searchInput.focus();
});

/* ---------- toolbar & keyboard ---------- */

function shiftMonth(delta) {
  const d = new Date(viewYear, viewMonth + delta, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  clampSelectionToView();
  render();
}

function goToday() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  selectedISO = toISO(now);
  render();
}

function clampSelectionToView() {
  const sel = parseDate(selectedISO);
  if (sel.getFullYear() !== viewYear || sel.getMonth() !== viewMonth) {
    selectedISO = toISO(new Date(viewYear, viewMonth, 1));
  }
}

document.getElementById("prevBtn").addEventListener("click", () => shiftMonth(-1));
document.getElementById("nextBtn").addEventListener("click", () => shiftMonth(1));
document.getElementById("todayBtn").addEventListener("click", goToday);
document.getElementById("newBtn").addEventListener("click", () => openEditor(null));
addForDayBtn.addEventListener("click", () => openEditor(null, selectedISO));

document.addEventListener("keydown", (e) => {
  if (editor.open || typeManager.open) {
    if (e.key === "Escape" && typeManager.open) typeManager.close();
    return;
  }

  if (e.key === "/" && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
    return;
  }

  if (document.activeElement === searchInput) {
    if (e.key === "Escape") {
      searchQuery = "";
      searchInput.value = "";
      updateSearchUI();
      render();
      searchInput.blur();
    }
    return;
  }

  switch (e.key) {
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowDown": {
      e.preventDefault();
      const sel = parseDate(selectedISO);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      sel.setDate(sel.getDate() + step);
      selectedISO = toISO(sel);
      if (sel.getFullYear() !== viewYear || sel.getMonth() !== viewMonth) {
        viewYear = sel.getFullYear();
        viewMonth = sel.getMonth();
      }
      render();
      break;
    }
    case "Enter":
      e.preventDefault();
      openEditor(null, selectedISO);
      break;
    case "n":
    case "N":
      e.preventDefault();
      openEditor(null);
      break;
    case "t":
    case "T":
      goToday();
      break;
    case "PageUp":
      e.preventDefault();
      shiftMonth(-1);
      break;
    case "PageDown":
      e.preventDefault();
      shiftMonth(1);
      break;
  }
});

// Clicking a day in the sidebar pane focuses it on the grid
dayTitle.addEventListener("click", () => {
  const d = parseDate(selectedISO);
  if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) {
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    render();
  }
});

/* ---------- boot ---------- */

(async function init() {
  events = (await window.api.loadEvents()) || [];
  types = (await window.api.loadTypes()) || [];
  // Safety net if main ever returns an empty/registry-less list.
  if (!types.some((t) => t.id === "other")) {
    types = [...types, { id: "other", ...EVENT_TYPES.other }];
  }
  populateTypeSelect();
  renderTypeSidebar();
  dataNote.title = await window.api.getDataPath();
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  render();
})();
