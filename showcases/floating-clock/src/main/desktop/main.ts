import { app, LynxWindow, lynxBridge } from "@lynx-js/lynxtron";
import { LYNX_BUNDLE_PATH } from "./vendorPaths";

let mainWindow: LynxWindow | null = null;

app.whenReady().then(() => {
  // Register the invoke handler once; it survives across window recreation.
  lynxBridge.handle("close", () => {
    mainWindow?.close();
    return "";
  });

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

  mainWindow.show();
  mainWindow.loadFile(LYNX_BUNDLE_PATH);
}
