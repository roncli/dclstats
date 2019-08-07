const {app, BrowserWindow} = require("electron");

let win;

/**
 * Creates the main window.
 * @returns {void}
 */
const createWindow = () => {
    win = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.loadURL("file://" + __dirname + "/index.htm");
    win.setMenu(null);
    win.maximize();
    win.toggleDevTools(); // TODO: Remove for release.

    win.once("ready-to-show", () => {
        win.show();
    });

    win.on("closed", () => {
        win = null;
    });
};

app.disableHardwareAcceleration();

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (win === null) {
        createWindow();
    }
});
