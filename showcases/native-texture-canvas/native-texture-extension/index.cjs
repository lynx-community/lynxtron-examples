const fs = require('fs');
const path = require('path');
const manifest = require('./lynx.lib.json');

const target = manifest.platforms.lynxtron.targets.find(
  ({ os, arch }) => os === process.platform && arch === process.arch,
);

if (!target) {
  throw new Error(
    `lynxtron-native-texture-canvas does not provide a binary for ${process.platform}/${process.arch}`,
  );
}

const binaryPaths = Array.isArray(target.files)
  ? target.files.filter((file) => path.extname(file) === '.node')
  : [];
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
