import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke("save-settings", settings),
  toggleFullscreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
