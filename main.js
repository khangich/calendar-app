const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { EVENT_TYPES } = require("./recurrence.js");

const EVENTS_FILE = path.join(__dirname, "events.json");
const TYPES_FILE = path.join(__dirname, "types.json");

// Editable type registry; "other" is the permanent fallback so it is
// re-added if a hand-edited types.json ever loses it.
const DEFAULT_TYPES = Object.entries(EVENT_TYPES).map(([id, t]) => ({ id, label: t.label, color: t.color }));

function saveTypes(types) {
  const tmp = TYPES_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(types, null, 2), "utf-8");
  fs.renameSync(tmp, TYPES_FILE);
}

function loadTypes() {
  try {
    const arr = JSON.parse(fs.readFileSync(TYPES_FILE, "utf-8"));
    if (Array.isArray(arr)) {
      const clean = arr.filter((t) => t && t.id && t.label && t.color);
      if (clean.length && clean.some((t) => t.id === "other")) return clean;
    }
  } catch {
    // missing or corrupt file -> fall through and reseed
  }
  saveTypes(DEFAULT_TYPES);
  return DEFAULT_TYPES;
}

function loadEvents() {
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveEvents(events) {
  const tmp = EVENTS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(events, null, 2), "utf-8");
  fs.renameSync(tmp, EVENTS_FILE);
}

ipcMain.handle("events:load", () => loadEvents());
ipcMain.handle("events:save", (_e, events) => {
  saveEvents(events);
  return true;
});
ipcMain.handle("events:path", () => EVENTS_FILE);

ipcMain.handle("types:load", () => loadTypes());
ipcMain.handle("types:save", (_e, types) => {
  saveTypes(types);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1020,
    height: 680,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: "#1e1e2e",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
