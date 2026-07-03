const fs = require('fs')
const path = require('path')

let modulePath = path.join(__dirname, 'build', 'Release', 'lynx_scintilla_module.node');

const setUp = () => {
  if (!fs.existsSync(modulePath)) {
    console.warn(`[lynxtron-scintilla-editor] Native module not found at ${modulePath}; skipping registration.`);
    return false;
  }

  let registerGlobalEnvModule;
  let extension_module;
  try {
    ({ registerGlobalEnvModule } = process._linkedBinding("lynx_extension"));
    extension_module = require(modulePath);
  } catch (error) {
    console.warn(`[lynxtron-scintilla-editor] Native module load failed: ${error?.message ?? error}`);
    return false;
  }

  const creator = extension_module.createExtensionModule();
  if (creator && registerGlobalEnvModule) {
    registerGlobalEnvModule(creator.name, creator.creatorModuleFunc, creator.isLazyCreate, creator.opaque);
    return true;
  } else {
    throw "lynx extension config is empty"
  }
}

exports.setUp = setUp;
