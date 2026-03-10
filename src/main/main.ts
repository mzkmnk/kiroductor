import { app, BrowserWindow } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { AcpManager } from "./acp/acp-manager.js";
import { registerIpcHandlers } from "./ipc-handlers.js";

if (started) {
  app.quit();
}

const acpManager = new AcpManager();
registerIpcHandlers(acpManager);

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: "Kiroductor",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  acpManager.setMainWindow(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.on("closed", () => {
    acpManager.setMainWindow(null);
  });
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  acpManager.stop().catch(console.error);
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
