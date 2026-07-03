import { app, LynxWindow } from "@lynx-js/lynxtron";
import { LYNX_BUNDLE_PATH } from "./vendorPaths";

let mainWindow: LynxWindow | null = null;

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (LynxWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function createWindow() {
  mainWindow = new LynxWindow({
    width: 500,
    height: 300,
    title: "Floating Clock",
    frame: false,
    transparent: true,
  });

  // 处理来自 Lynx 的调用 - bridge.call
  mainWindow.on("-lynx-invoke", (event, methodName) => {
    if (!mainWindow) {
      event.sendReply("");
      return;
    }

    switch (methodName) {
      case "close":
        mainWindow.close();
        event.sendReply("");
        break;
      default:
        event.sendReply("");
    }
  });

  mainWindow.show();
  mainWindow.loadFile(LYNX_BUNDLE_PATH);
}
