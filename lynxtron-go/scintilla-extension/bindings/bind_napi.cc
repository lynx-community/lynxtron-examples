// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#include <napi.h>

#include "capi/lynx_extension_module_types_capi.h"
#include "module/scintilla_extension_module.h"
#ifdef _WIN32
#include "module/native_edit_command.h"
#endif

typedef struct lynx_extension_module_creator_api_t {
  extension_module_creator create_module_func;
} lynx_extension_module_creator_api_t;

napi_value GetModuleCreator(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  auto* creator_api = new lynx_extension_module_creator_api_t{
      .create_module_func = scintilla_extension_module_create_extension_module,
  };

  auto result = Napi::Object::New(env);
  result.Set("name", Napi::String::New(env, "ScintillaExtensionModule"));

  result.Set("creatorModuleFunc",
             Napi::External<void>::New(
                 env, creator_api, [](Napi::Env env, void* data) {
                   delete (lynx_extension_module_creator_api_t*)data;
                 }));
  result.Set("isLazyCreate", Napi::Boolean::New(env, false));
  result.Set("opaque", Napi::External<void>::New(env, nullptr));

  return result;
}

napi_value CreateExtensionModule(const Napi::CallbackInfo& info) {
  return GetModuleCreator(info);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
#ifdef _WIN32
  exports.Set("executeFocusedEditCommand", Napi::Function::New(env,
      [](const Napi::CallbackInfo& info) -> Napi::Value {
        if (info.Length() != 1 || !info[0].IsString()) {
          Napi::TypeError::New(info.Env(), "Expected an edit command string")
              .ThrowAsJavaScriptException();
          return info.Env().Undefined();
        }
        return Napi::Boolean::New(info.Env(), extension::ExecuteFocusedEditCommand(
            info[0].As<Napi::String>().Utf8Value()));
      }));
#endif
  exports.Set("createExtensionModule", Napi::Function::New(env, CreateExtensionModule));
  return exports;
}

NODE_API_MODULE(lynx_scintilla_module, Init)
