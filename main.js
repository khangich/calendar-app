const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { EVENT_TYPES } = require("./recurrence.js");

const DEFAULT_TYPES = Object.entries(EVENT_TYPES).map(([id, t]) => ({ id, label: t.label, color: t.color }));

function getDataDir() {
  try {
    return app.getPath("userData");
  } catch {
    return __dirname;
  }
}

function getEventsPath() {
  return path.join(getDataDir(), "events.json");
}

function getTypesPath() {
  return path.join(getDataDir(), "types.json");
}

function getLegacyPath(file) {
  return path.join(__dirname, file);
}

function ensureDataDir() {
  try {
    fs.mkdirSync(getDataDir(), { recursive: true });
  } catch {}
}

function migrateIfNeeded() {
  ensureDataDir();
  for (const file of ["events.json", "types.json"]) {
    const legacy = getLegacyPath(file);
    const modern = path.join(getDataDir(), file);
    if (modern === legacy) continue;
    try {
      if (!fs.existsSync(modern) && fs.existsSync(legacy)) {
        fs.copyFileSync(legacy, modern);
      }
    } catch {}
  }
}

function saveTypes(types) {
  ensureDataDir();
  migrateIfNeeded();
  const file = getTypesPath();
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(types, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

function loadTypes() {
  ensureDataDir();
  migrateIfNeeded();
  const file = getTypesPath();
  try {
    const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (Array.isArray(arr)) {
      const clean = arr.filter((t) => t && t.id && t.label && t.color);
      if (clean.length && clean.some((t) => t.id === "other")) return clean;
    }
  } catch {}
  saveTypes(DEFAULT_TYPES);
  return DEFAULT_TYPES;
}

function loadEvents() {
  ensureDataDir();
  migrateIfNeeded();
  try {
    return JSON.parse(fs.readFileSync(getEventsPath(), "utf-8"));
  } catch {
    return [];
  }
}

function saveEvents(events) {
  ensureDataDir();
  migrateIfNeeded();
  const file = getEventsPath();
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(events, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

ipcMain.handle("events:load", () => loadEvents());
ipcMain.handle("events:save", (_e, events) => {
  saveEvents(events);
  return true;
});
ipcMain.handle("events:path", () => getEventsPath());

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

app.whenReady().then(() => {
  migrateIfNeeded();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
