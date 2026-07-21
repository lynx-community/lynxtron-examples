// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#include "module/http_service_extension_module.h"

#include <mutex>

#include "capi/lynx_log_capi.h"
#include "lynx_service_center.h"

namespace extension {
namespace {

// The service center is process-global and the engine looks the HTTP service
// up by type, so one registration serves every LynxView/runtime in the
// process — register once no matter how many times the module is created.
void RegisterHttpServiceOnce() {
  static std::once_flag flag;
  std::call_once(flag, [] {
    auto service = CreatePlatformHttpService();
    if (!service) {
      LYNX_CAPI_LOG(LYNX_LOG_ERROR, "HttpServiceExtension",
                    "platform HTTP service unavailable; fetch stays disabled");
      return;
    }
    lynx::pub::LynxServiceCenter::GetInstance().RegisterService(service);
    LYNX_CAPI_LOG(LYNX_LOG_INFO, "HttpServiceExtension",
                  "LynxHttpService registered; Fetch API enabled");
  });
}

Napi::Value HttpServiceExtensionModuleMethodsBinder(
    Napi::Env env, Napi::Value exports, const char* module_name,
    HttpServiceExtensionModule& module) {
  if (!exports.IsObject()) {
    return exports;
  }
  // No JS surface: the extension's whole job is the native-side service
  // registration. Export a marker so JS can feature-detect it if needed.
  Napi::Object exports_obj = exports.As<Napi::Object>();
  exports_obj.Set("installed", Napi::Boolean::New(env, true));
  return exports;
}

}  // namespace

void HttpServiceExtensionModule::OnLynxViewCreate(lynx_view_t* lynx_view) {}
void HttpServiceExtensionModule::OnLynxViewDestroy() {}
void HttpServiceExtensionModule::OnRuntimeInit() {}
void HttpServiceExtensionModule::OnRuntimeAttach(
    Napi::Env env,
    std::unique_ptr<lynx::pub::VSyncObserver> vsync_observer) {
  (void)env;
  (void)vsync_observer;
}
void HttpServiceExtensionModule::OnRuntimeReady(Napi::Env env, Napi::Value lynx,
                                                const char* url) {}
void HttpServiceExtensionModule::OnRuntimeDetach() {}
void HttpServiceExtensionModule::OnEnterForeground() {}
void HttpServiceExtensionModule::OnEnterBackground() {}
void HttpServiceExtensionModule::Destroy() {}

}  // namespace extension

LYNX_EXTERN_C lynx_extension_module_t*
http_service_extension_module_create_extension_module(void* opaque) {
  extension::RegisterHttpServiceOnce();

  auto* module = new extension::HttpServiceExtensionModule();
  lynx_extension_module_t* c_module =
      lynx_extension_module_create_with_finalizer(
          module, [](lynx_extension_module_t* m, void* user_data) {
            if (user_data) {
              delete reinterpret_cast<extension::HttpServiceExtensionModule*>(
                  user_data);
            }
          });

  module->SetCModule(c_module);
  module->SetNapiModuleCreator(
      &extension::HttpServiceExtensionModuleMethodsBinder);
  return c_module;
}
