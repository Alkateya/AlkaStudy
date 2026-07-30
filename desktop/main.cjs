const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

// Keep the exact profile identity used by the approved 1.0.0 portable build.
// Electron derives localStorage/IndexedDB paths from the application name, so
// changing productName during packaging would otherwise make existing data
// appear to have disappeared.
app.setName("alkastudy-offline");
app.setPath("userData", path.join(app.getPath("appData"), "alkastudy-offline"));

app.setAboutPanelOptions({
  applicationName: "AlkaStudy",
  applicationVersion: app.getVersion(),
  copyright: "Copyright © 2026 Tiago Pereira de Medeiros. Todos os direitos reservados.",
  authors: ["Tiago Pereira de Medeiros"],
  website: "mailto:alkateyadev@gmail.com",
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 650,
    backgroundColor: "#101524",
    autoHideMenuBar: true,
    title: "AlkaStudy",
    icon: path.join(__dirname, "../build/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.loadFile(path.join(__dirname, "../dist-desktop/index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
