const fs = require('fs');
const path = require('path');
const manifest = require('./lynx.lib.json');

const binary = manifest.platforms.lynxtron.binaries.find(
  ({ os, arch }) => os === process.platform && arch === process.arch,
);

if (!binary) {
  throw new Error(
    `lynxtron-native-texture-canvas does not provide a binary for ${process.platform}/${process.arch}`,
  );
}

const binaryPaths = Array.isArray(binary.path) ? binary.path : [binary.path];
if (binaryPaths.length !== 1) {
  throw new Error(
    `lynxtron-native-texture-canvas expected exactly one binary for ${process.platform}/${process.arch}`,
  );
}

const modulePath = path.resolve(__dirname, binaryPaths[0]);
let registered = false;

const setUp = () => {
  if (registered) {
    return true;
  }

  if (!fs.existsSync(modulePath)) {
    throw new Error(
      `[lynxtron-native-texture-canvas] Native module not found at ${modulePath}.`,
    );
  }

  const { registerGlobalEnvModule } = process._linkedBinding('lynx_extension');
  const extensionModule = require(modulePath);
  const creator = extensionModule.createExtensionModule();
  if (creator && registerGlobalEnvModule) {
    registerGlobalEnvModule(
      creator.name,
      creator.creatorModuleFunc,
      creator.isLazyCreate,
      creator.opaque,
    );
    registered = true;
    return true;
  }
  throw new Error('native texture canvas extension config is empty');
};

exports.setUp = setUp;
exports.registered = setUp();
