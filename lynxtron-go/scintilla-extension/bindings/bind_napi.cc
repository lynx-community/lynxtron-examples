// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#include <napi.h>

#include "capi/lynx_extension_module_types_capi.h"
#include "module/scintilla_extension_module.h"
#ifdef _WIN32
#include <windows.h>
#include <unordered_map>
#include "module/native_edit_command.h"
static std::unordered_map<HWND, HMENU> g_window_menus;
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
  exports.Set("hideWindowMenuBar", Napi::Function::New(env,
      [](const Napi::CallbackInfo& info) -> Napi::Value {
        if (info.Length() != 1 || !info[0].IsBuffer()) {
          Napi::TypeError::New(info.Env(), "Expected a native window handle")
              .ThrowAsJavaScriptException();
          return info.Env().Undefined();
        }
        const auto buffer = info[0].As<Napi::Buffer<uint8_t>>();
        HWND hwnd = nullptr;
        if (buffer.Length() == sizeof(hwnd)) {
          memcpy(&hwnd, buffer.Data(), sizeof(hwnd));
        }
        DWORD pid = 0;
        if (hwnd) GetWindowThreadProcessId(hwnd, &pid);
        if (!hwnd || !IsWindow(hwnd) || pid != GetCurrentProcessId()) {
          return Napi::Boolean::New(info.Env(), false);
        }
        // The runtime retains ownership of HMENU and its accelerators. Only
        // remove the visible bar; GO reveals that same menu from its header.
        if (HMENU menu = GetMenu(hwnd)) g_window_menus[hwnd] = menu;
        const bool hidden = SetMenu(hwnd, nullptr) != FALSE;
        DrawMenuBar(hwnd);
        return Napi::Boolean::New(info.Env(), hidden);
      }));
  exports.Set("showWindowMenu", Napi::Function::New(env,
      [](const Napi::CallbackInfo& info) -> Napi::Value {
        if (info.Length() != 1 || !info[0].IsBuffer()) return info.Env().Undefined();
        const auto buffer = info[0].As<Napi::Buffer<uint8_t>>();
        HWND hwnd = nullptr;
        if (buffer.Length() == sizeof(hwnd)) memcpy(&hwnd, buffer.Data(), sizeof(hwnd));
        const auto menu = g_window_menus.find(hwnd);
        DWORD pid = 0;
        if (hwnd) GetWindowThreadProcessId(hwnd, &pid);
        if (!IsWindow(hwnd) || pid != GetCurrentProcessId() ||
            menu == g_window_menus.end() || !IsMenu(menu->second)) {
          return Napi::Boolean::New(info.Env(), false);
        }
        // Borrow the application's existing submenus. Their command IDs still
        // dispatch through the runtime's normal WM_COMMAND handler.
        HMENU popup = CreatePopupMenu();
        if (!popup) return Napi::Boolean::New(info.Env(), false);
        const int count = GetMenuItemCount(menu->second);
        for (int i = 0; i < count; ++i) {
          wchar_t label[256] = {};
          GetMenuStringW(menu->second, i, label, 256, MF_BYPOSITION);
          HMENU submenu = GetSubMenu(menu->second, i);
          if (submenu) AppendMenuW(popup, MF_POPUP,
              reinterpret_cast<UINT_PTR>(submenu), label);
        }
        POINT point = {};
        GetCursorPos(&point);
        const UINT command = TrackPopupMenuEx(popup,
            TPM_RETURNCMD | TPM_RIGHTALIGN | TPM_TOPALIGN | TPM_RIGHTBUTTON,
            point.x, point.y, hwnd, nullptr);
        // Destroy only our temporary container, never the borrowed submenus.
        while (GetMenuItemCount(popup) > 0) RemoveMenu(popup, 0, MF_BYPOSITION);
        DestroyMenu(popup);
        if (command) PostMessageW(hwnd, WM_COMMAND, MAKEWPARAM(command, 0), 0);
        return Napi::Boolean::New(info.Env(), true);
      }));
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
