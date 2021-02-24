import "colors";
import {
  app,
  shell,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  BrowserWindowConstructorOptions,
} from "electron";
import path from "path";
import installExtension, {
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS,
} from "electron-devtools-installer";
import colors from "@foxglove-studio/app/styles/colors.module.scss";

import type { OsContextWindowEvent } from "@foxglove-studio/app/OsContext";

declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const isMac: boolean = process.platform === "darwin";

const createWindow = (): void => {
  const windowOptions: BrowserWindowConstructorOptions = {
    height: 800,
    width: 1200,
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(app.getAppPath(), "preload.js"), // MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
    backgroundColor: colors.background,
  };
  if (isMac) {
    windowOptions.titleBarStyle = "hiddenInset";
  }
  const mainWindow = new BrowserWindow(windowOptions);

  // Forward full screen events to the renderer
  const forwardWindowEvent = (name: OsContextWindowEvent) => {
    // @ts-ignore https://github.com/microsoft/TypeScript/issues/14107
    mainWindow.addListener(name, () => {
      mainWindow.webContents.send(name);
    });
  };
  forwardWindowEvent("enter-full-screen");
  forwardWindowEvent("leave-full-screen");

  const appMenuTemplate: MenuItemConstructorOptions[] = [];

  if (isMac) {
    appMenuTemplate.push({
      role: "appMenu",
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  appMenuTemplate.push({
    role: "fileMenu",
    label: "File",
    submenu: [
      {
        label: "Open Bag",
        click: async () => {
          // <input> elements can only be opened on user interaction
          // We fake a uesr interaction which allows us to invoke input.click() in renderer thread
          // This is a trick which allows us to then handle file opening completely in the browser
          // logic rather than via IPC interfaces.
          mainWindow.focus();
          mainWindow.webContents.sendInputEvent({
            type: "mouseDown",
            x: -1,
            y: -1,
          });
          mainWindow.webContents.sendInputEvent({
            type: "mouseUp",
            x: -1,
            y: -1,
          });
          setTimeout(() => {
            mainWindow.webContents.send("menu.file.open-bag");
          }, 10);
        },
      },
      {
        label: "Open Websocket Url",
        click: async () => {
          mainWindow.webContents.send("menu.file.open-websocket-url");
        },
      },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  });

  appMenuTemplate.push({
    role: "editMenu",
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" } as const,
            { role: "delete" } as const,
            { role: "selectAll" } as const,
          ]
        : [
            { role: "delete" } as const,
            { type: "separator" } as const,
            { role: "selectAll" } as const,
          ]),
    ],
  });

  appMenuTemplate.push({
    role: "viewMenu",
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  });

  appMenuTemplate.push({
    role: "help",
    submenu: [
      {
        label: "Learn More",
        click: async () => {
          await shell.openExternal("https://electronjs.org");
        },
      },
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenuTemplate));

  //mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.loadURL("http://localhost:8080/renderer/index.html");

  if (process.env.NODE_ENV !== "production") {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  if (process.env.NODE_ENV !== "production") {
    console.group("Installing Chrome extensions for development...");
    // Extension installation sometimes gets stuck between the download step and the extension loading step, for unknown reasons. A retry usually fixes it.
    const timeout = setTimeout(() => {
      console.warn(
        "If installation takes a long time, it may be stuck. Try relaunching electron or deleting its extensions directory."
          .yellow,
      );
    }, 5000);
    const results = await Promise.allSettled([
      installExtension(REACT_DEVELOPER_TOOLS),
      installExtension(REDUX_DEVTOOLS),
    ]);
    clearTimeout(timeout);
    console.log("Finished:", results);
    console.groupEnd();
  }

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
