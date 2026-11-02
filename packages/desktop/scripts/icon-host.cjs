const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => { new BrowserWindow({ show: false, width: 600, height: 600 }).loadURL('about:blank'); });
