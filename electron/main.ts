import { app, BrowserWindow, ipcMain, session } from "electron";
import * as path from "path";
import * as fs from "fs";

const isDev = !app.isPackaged;

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings(): Record<string, unknown> {
  try {
    const data = fs.readFileSync(getSettingsPath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveSettings(settings: Record<string, unknown>): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // electron-dist/preload.js
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Allow pointer lock without user gesture requirement
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === "pointerLock") {
        callback(true);
      } else {
        callback(true);
      }
    }
  );

  if (isDev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../out/index.html"));
  }
}

// IPC handlers
ipcMain.handle("load-settings", () => loadSettings());
ipcMain.handle("save-settings", (_event, settings) => {
  saveSettings(settings);
});
ipcMain.handle("toggle-fullscreen", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setFullScreen(!win.isFullScreen());
  }
});
ipcMain.handle("quit-app", () => {
  app.quit();
});
ipcMain.handle("get-app-version", () => app.getVersion());

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
