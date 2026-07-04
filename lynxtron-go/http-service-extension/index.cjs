const fs = require('fs')
const path = require('path')

let modulePath = path.join(__dirname, 'build', 'Release', 'lynx_http_service_module.node');

const setUp = () => {
  // Default-off: the engine's fetch module hands the response body to JS as
  // a zero-copy EXTERNAL ArrayBuffer (lynx_fetch_module.cc), which the
  // sandbox-enabled V8 backing Lynxtron's background runtime rejects with a
  // process-fatal "backing stores must be allocated inside the sandbox".
  // With no service registered fetch() soft-fails; with one registered, any
  // body-bearing response would CRASH the app. Flip this on once the engine
  // copies the body into a V8-allocated buffer on desktop.
  if (process.env.LYNXTRON_ENABLE_HTTP_SERVICE !== '1') {
    console.log('[lynxtron-http-service] Disabled (set LYNXTRON_ENABLE_HTTP_SERVICE=1 to enable); UI fetch() will soft-fail.');
    return false;
  }
  if (!fs.existsSync(modulePath)) {
    console.warn(`[lynxtron-http-service] Native module not found at ${modulePath}; skipping registration.`);
    return false;
  }

  let registerGlobalEnvModule;
  let extension_module;
  try {
    ({ registerGlobalEnvModule } = process._linkedBinding("lynx_extension"));
    extension_module = require(modulePath);
  } catch (error) {
    console.warn(`[lynxtron-http-service] Native module load failed: ${error?.message ?? error}`);
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
