const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("alkastudyDesktop", { platform: process.platform, version: "0.4.0" });
