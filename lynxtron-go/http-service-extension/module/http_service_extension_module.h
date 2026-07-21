// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#ifndef HTTP_SERVICE_EXTENSION_MODULE_H_
#define HTTP_SERVICE_EXTENSION_MODULE_H_

#include <memory>

#include "capi/lynx_export.h"
#include "lynx_extension_module.h"
#include "lynx_http_service.h"
#include "lynx_view.h"
#include "third_party/weak-node-api/headers/napi.h"

namespace extension {

// Registers a LynxHttpService with the engine's LynxServiceCenter so the
// standard Lynx Fetch API works in UI-side JS. The Lynxtron desktop host
// ships no HTTP service of its own — without one, every fetch() dies inside
// the engine with "request_func is unimplemented".
class HttpServiceExtensionModule : public lynx::pub::LynxExtensionModule {
 public:
  HttpServiceExtensionModule() = default;
  ~HttpServiceExtensionModule() override = default;

  void OnLynxViewCreate(lynx_view_t* lynx_view) override;
  void OnLynxViewDestroy() override;
  void OnRuntimeInit() override;
  void OnRuntimeAttach(
      Napi::Env env,
      std::unique_ptr<lynx::pub::VSyncObserver> vsync_observer) override;
  void OnRuntimeReady(Napi::Env env, Napi::Value lynx, const char* url) override;
  void OnRuntimeDetach() override;
  void OnEnterForeground() override;
  void OnEnterBackground() override;
  void Destroy() override;
};

// Platform HTTP backend (NSURLSession on macOS, WinHTTP on Windows).
// Defined in http_service_darwin.mm / http_service_win.cc.
std::shared_ptr<lynx::pub::LynxHttpService> CreatePlatformHttpService();

}  // namespace extension

LYNX_EXTERN_C_BEGIN
LYNX_CAPI_EXPORT lynx_extension_module_t*
http_service_extension_module_create_extension_module(void* opaque);
LYNX_EXTERN_C_END

#endif  // HTTP_SERVICE_EXTENSION_MODULE_H_
