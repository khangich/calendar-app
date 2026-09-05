const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loadEvents: () => ipcRenderer.invoke("events:load"),
  saveEvents: (events) => ipcRenderer.invoke("events:save", events),
  getDataPath: () => ipcRenderer.invoke("events:path"),
  loadTypes: () => ipcRenderer.invoke("types:load"),
  saveTypes: (types) => ipcRenderer.invoke("types:save", types),
});
