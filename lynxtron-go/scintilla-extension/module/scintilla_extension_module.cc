// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#include "module/scintilla_extension_module.h"

#include "module/scintilla_view.h"
#include "capi/lynx_log_capi.h"

#ifdef _WIN32
#include <windows.h>
#endif

#include <cctype>
#include <cstdint>
#include <cstring>
#include <string>
#include <tuple>
#include <vector>

namespace extension {
namespace {

void ModuleDebugLog(const std::string& message) {
#if defined(_WIN32) && defined(LYNXTRON_SCINTILLA_DEBUG)
  char temp_path[MAX_PATH] = {};
  DWORD length = ::GetTempPathA(MAX_PATH, temp_path);
  if (length == 0 || length >= MAX_PATH) return;
  std::string path(temp_path);
  path += "lynxtron_scintilla_module.log";

  std::string line = message + "\r\n";
  HANDLE file = ::CreateFileA(path.c_str(),
                              FILE_APPEND_DATA,
                              FILE_SHARE_READ | FILE_SHARE_WRITE,
                              nullptr,
                              OPEN_ALWAYS,
                              FILE_ATTRIBUTE_NORMAL,
                              nullptr);
  if (file == INVALID_HANDLE_VALUE) return;
  DWORD written = 0;
  ::WriteFile(file, line.data(), static_cast<DWORD>(line.size()), &written, nullptr);
  ::CloseHandle(file);
#else
  (void)message;
#endif
}

int Base64DecodeValue(unsigned char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '+') return 62;
  if (c == '/') return 63;
  return -1;
}

bool DecodeBase64(const std::string& input, std::string* output) {
  output->clear();

  int value = 0;
  int bits = -8;
  bool seen_padding = false;

  for (unsigned char c : input) {
    if (std::isspace(c)) continue;
    if (c == '=') {
      seen_padding = true;
      continue;
    }
    if (seen_padding) return false;

    const int decoded = Base64DecodeValue(c);
    if (decoded < 0) return false;

    value = (value << 6) | decoded;
    bits += 6;
    if (bits >= 0) {
      output->push_back(static_cast<char>((value >> bits) & 0xFF));
      bits -= 8;
    }
  }

  return true;
}

std::vector<std::tuple<int, int, int>> ParseIndicatorRanges(const char* data,
                                                            size_t byte_length) {
  const size_t kTripletBytes = 3 * sizeof(int32_t);
  size_t count = byte_length / kTripletBytes;
  std::vector<std::tuple<int, int, int>> ranges;
  ranges.reserve(count);

  for (size_t i = 0; i < count; i++) {
    int32_t start = 0;
    int32_t length = 0;
    int32_t style = 0;
    const char* cursor = data + i * kTripletBytes;
    std::memcpy(&start, cursor, sizeof(int32_t));
    std::memcpy(&length, cursor + sizeof(int32_t), sizeof(int32_t));
    std::memcpy(&style, cursor + 2 * sizeof(int32_t), sizeof(int32_t));
    ranges.emplace_back(static_cast<int>(start),
                        static_cast<int>(length),
                        static_cast<int>(style));
  }

  return ranges;
}

Napi::Value SetText(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  ModuleDebugLog("SetText: enter");

  if (info.Length() < 2) {
    LYNX_CAPI_LOG(LYNX_LOG_ERROR, "ScintillaExtension",
                  "SetText: Invalid argument count %zu", info.Length());
    Napi::TypeError::New(env, "Expected (string editorId, string content)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  ModuleDebugLog("SetText: editorId=" + editorId);

  bool success = false;
  if (info[1].IsArrayBuffer()) {
    Napi::ArrayBuffer buf = info[1].As<Napi::ArrayBuffer>();
    ModuleDebugLog("SetText: arraybuffer length=" + std::to_string(buf.ByteLength()));
    success = ScintillaRegistry::Get().SetContent(
        editorId, reinterpret_cast<char*>(buf.Data()), buf.ByteLength());
  } else {
    std::string content = info[1].As<Napi::String>().Utf8Value();
    ModuleDebugLog("SetText: string length=" + std::to_string(content.size()));
    success = ScintillaRegistry::Get().SetContent(editorId, content.data(),
                                                  content.size());
  }
  ModuleDebugLog(std::string("SetText: result=") + (success ? "true" : "false"));

  return Napi::Boolean::New(env, success);
}

Napi::Value GetText(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();

  ScintillaView* view = ScintillaRegistry::Get().GetView(editorId);
  if (view) {
    std::string content = view->GetContent();
    return Napi::String::New(env, content);
  }
  // null, NOT "": callers flush getText() into document state, and an
  // unregistered editor id must read as "no editor" — an empty string here
  // silently wipes the file's content during mosaic rebuild windows.
  return env.Null();
}

Napi::Value SetStyles(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  ModuleDebugLog("SetStyles: enter");

  if (info.Length() < 3) {
    Napi::TypeError::New(
        env, "Expected (string editorId, int startPos, ArrayBuffer|string styles)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  ModuleDebugLog("SetStyles: editorId=" + editorId);

  int32_t startPos = info[1].As<Napi::Number>().Int32Value();
  ModuleDebugLog("SetStyles: startPos=" + std::to_string(startPos));

  bool success = false;
  if (info[2].IsArrayBuffer()) {
    Napi::ArrayBuffer buf = info[2].As<Napi::ArrayBuffer>();
    ModuleDebugLog("SetStyles: byteLength=" + std::to_string(buf.ByteLength()));
    success = ScintillaRegistry::Get().ApplyStyles(
        editorId, startPos, reinterpret_cast<char*>(buf.Data()), buf.ByteLength());
  } else if (info[2].IsString()) {
    std::string decoded;
    if (!DecodeBase64(info[2].As<Napi::String>().Utf8Value(), &decoded)) {
      Napi::TypeError::New(env, "Invalid base64 styles string")
          .ThrowAsJavaScriptException();
      return env.Null();
    }
    ModuleDebugLog("SetStyles: base64 byteLength=" + std::to_string(decoded.size()));
    success = ScintillaRegistry::Get().ApplyStyles(
        editorId, startPos, decoded.data(), decoded.size());
  } else {
    Napi::TypeError::New(env, "Expected ArrayBuffer or base64 string for styles")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  ModuleDebugLog(std::string("SetStyles: result=") + (success ? "true" : "false"));
  return Napi::Boolean::New(env, success);
}

Napi::Value HasContentChanged(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  ScintillaView* view = ScintillaRegistry::Get().GetView(editorId);
  bool changed = view ? view->ConsumeContentChanged() : false;
  return Napi::Boolean::New(env, changed);
}

Napi::Value SetIndicators(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2) {
    Napi::TypeError::New(
        env, "Expected (string editorId, ArrayBuffer|string buffer)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();

  std::vector<std::tuple<int, int, int>> ranges;
  if (info[1].IsArrayBuffer()) {
    Napi::ArrayBuffer buf = info[1].As<Napi::ArrayBuffer>();
    ranges = ParseIndicatorRanges(reinterpret_cast<const char*>(buf.Data()),
                                  buf.ByteLength());
  } else if (info[1].IsString()) {
    std::string decoded;
    if (!DecodeBase64(info[1].As<Napi::String>().Utf8Value(), &decoded)) {
      Napi::TypeError::New(env, "Invalid base64 indicators string")
          .ThrowAsJavaScriptException();
      return env.Null();
    }
    ranges = ParseIndicatorRanges(decoded.data(), decoded.size());
  } else {
    Napi::TypeError::New(
        env, "Expected ArrayBuffer or base64 string for indicators")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  bool success = ScintillaRegistry::Get().SetIndicators(editorId, ranges);
  return Napi::Boolean::New(env, success);
}

Napi::Value ClearIndicators(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  bool success = ScintillaRegistry::Get().ClearIndicators(editorId);
  return Napi::Boolean::New(env, success);
}

Napi::Value ShowCalltip(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3) {
    Napi::TypeError::New(
        env, "Expected (string editorId, number bytePos, string text)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  int32_t bytePos = info[1].As<Napi::Number>().Int32Value();
  std::string text = info[2].As<Napi::String>().Utf8Value();

  bool success = ScintillaRegistry::Get().ShowCalltip(editorId, bytePos, text);
  return Napi::Boolean::New(env, success);
}

Napi::Value HideCalltip(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  bool success = ScintillaRegistry::Get().HideCalltip(editorId);
  return Napi::Boolean::New(env, success);
}

Napi::Value GetDwellInfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  ScintillaView* view = ScintillaRegistry::Get().GetView(editorId);

  Napi::Object obj = Napi::Object::New(env);
  if (view) {
    auto di = view->GetDwellInfo();
    obj.Set("active", Napi::Boolean::New(env, di.active));
    obj.Set("bytePos", Napi::Number::New(env, di.bytePos));
    obj.Set("x", Napi::Number::New(env, di.x));
    obj.Set("y", Napi::Number::New(env, di.y));
  } else {
    obj.Set("active", Napi::Boolean::New(env, false));
    obj.Set("bytePos", Napi::Number::New(env, -1));
    obj.Set("x", Napi::Number::New(env, 0.0));
    obj.Set("y", Napi::Number::New(env, 0.0));
  }
  return obj;
}

Napi::Value GotoLine(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Expected (string editorId, number line)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  int32_t line = info[1].As<Napi::Number>().Int32Value();

  bool success = ScintillaRegistry::Get().GotoLine(editorId, line);
  return Napi::Boolean::New(env, success);
}

Napi::Value SetSelection(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3) {
    Napi::TypeError::New(
        env, "Expected (string editorId, number anchor, number caret)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  int32_t anchor = info[1].As<Napi::Number>().Int32Value();
  int32_t caret = info[2].As<Napi::Number>().Int32Value();

  bool success = ScintillaRegistry::Get().SetSelection(editorId, anchor, caret);
  return Napi::Boolean::New(env, success);
}

Napi::Value ScrollCaret(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  bool success = ScintillaRegistry::Get().ScrollCaret(editorId);
  return Napi::Boolean::New(env, success);
}

// focus(editorId: string) -> bool — keyboard focus to that editor
Napi::Value Focus(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  bool success = ScintillaRegistry::Get().Focus(editorId);
  return Napi::Boolean::New(env, success);
}

Napi::Value DetachFromWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  bool success = ScintillaRegistry::Get().DetachFromWindow(editorId);
  return Napi::Boolean::New(env, success);
}

// attachToWindow(editorId: string) -> bool — re-attach a previously
// detached editor view (inverse of detachFromWindow).
Napi::Value AttachToWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string editorId)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  bool success = ScintillaRegistry::Get().AttachToWindow(editorId);
  return Napi::Boolean::New(env, success);
}

// setEditorTheme(editorId: string, dark: bool, sizePt: number) -> bool
Napi::Value SetEditorTheme(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3) {
    Napi::TypeError::New(env,
                         "Expected (string editorId, bool dark, number sizePt)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string editorId = info[0].As<Napi::String>().Utf8Value();
  bool dark = info[1].As<Napi::Boolean>().Value();
  int32_t sizePt = info[2].As<Napi::Number>().Int32Value();

  bool success = ScintillaRegistry::Get().ApplyTheme(editorId, dark, sizePt);
  return Napi::Boolean::New(env, success);
}

Napi::Value CaptureWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected (string outputPath)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string output_path = info[0].As<Napi::String>().Utf8Value();
  bool success = ScintillaRegistry::Get().CaptureWindowToFile(output_path);
  return Napi::Boolean::New(env, success);
}

Napi::Value CaptureWindowToBase64(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::string b64 = ScintillaRegistry::Get().CaptureWindowToBase64();
  return Napi::String::New(env, b64);
}

Napi::Value ScintillaExtensionModuleMethodsBinder(
    Napi::Env env, Napi::Value exports, const char* module_name,
    ScintillaExtensionModule& module) {
  if (!exports.IsObject()) {
    return exports;
  }
  Napi::Object exports_obj = exports.As<Napi::Object>();
  exports_obj.Set("setText", Napi::Function::New(env, SetText, "setText"));
  exports_obj.Set("getText", Napi::Function::New(env, GetText, "getText"));
  exports_obj.Set("setStyles", Napi::Function::New(env, SetStyles, "setStyles"));
  exports_obj.Set("hasContentChanged",
                  Napi::Function::New(env, HasContentChanged, "hasContentChanged"));
  exports_obj.Set("setIndicators",
                  Napi::Function::New(env, SetIndicators, "setIndicators"));
  exports_obj.Set("clearIndicators",
                  Napi::Function::New(env, ClearIndicators, "clearIndicators"));
  exports_obj.Set("getDwellInfo",
                  Napi::Function::New(env, GetDwellInfo, "getDwellInfo"));
  exports_obj.Set("showCalltip",
                  Napi::Function::New(env, ShowCalltip, "showCalltip"));
  exports_obj.Set("hideCalltip",
                  Napi::Function::New(env, HideCalltip, "hideCalltip"));
  exports_obj.Set("gotoLine", Napi::Function::New(env, GotoLine, "gotoLine"));
  exports_obj.Set("setSelection",
                  Napi::Function::New(env, SetSelection, "setSelection"));
  exports_obj.Set("scrollCaret",
                  Napi::Function::New(env, ScrollCaret, "scrollCaret"));
  exports_obj.Set("focus", Napi::Function::New(env, Focus, "focus"));
  exports_obj.Set("detachFromWindow",
                  Napi::Function::New(env, DetachFromWindow, "detachFromWindow"));
  exports_obj.Set("attachToWindow",
                  Napi::Function::New(env, AttachToWindow, "attachToWindow"));
  exports_obj.Set("setEditorTheme",
                  Napi::Function::New(env, SetEditorTheme, "setEditorTheme"));
  exports_obj.Set("captureWindow",
                  Napi::Function::New(env, CaptureWindow, "captureWindow"));
  exports_obj.Set("captureWindowToBase64",
                  Napi::Function::New(env, CaptureWindowToBase64,
                                      "captureWindowToBase64"));
  return exports;
}

}  // namespace

void ScintillaExtensionModule::OnLynxViewCreate(lynx_view_t* lynx_view) {
  lynx_view_register_native_view(lynx_view, "scintilla-view",
                                 &scintilla_view_create_view, nullptr);
}
void ScintillaExtensionModule::OnLynxViewDestroy() {}
void ScintillaExtensionModule::OnRuntimeInit() {}
void ScintillaExtensionModule::OnRuntimeAttach(
    Napi::Env env,
    std::unique_ptr<lynx::pub::VSyncObserver> vsync_observer) {
  (void)env;
  (void)vsync_observer;
}
void ScintillaExtensionModule::OnRuntimeReady(Napi::Env env, Napi::Value lynx,
                                              const char* url) {}
void ScintillaExtensionModule::OnRuntimeDetach() {}
void ScintillaExtensionModule::OnEnterForeground() {}
void ScintillaExtensionModule::OnEnterBackground() {}
void ScintillaExtensionModule::Destroy() {}

}  // namespace extension

LYNX_EXTERN_C lynx_extension_module_t*
scintilla_extension_module_create_extension_module(void* opaque) {
  auto* module = new extension::ScintillaExtensionModule();
  lynx_extension_module_t* c_module =
      lynx_extension_module_create_with_finalizer(
          module, [](lynx_extension_module_t* m, void* user_data) {
            if (user_data) {
              delete reinterpret_cast<extension::ScintillaExtensionModule*>(
                  user_data);
            }
          });

  module->SetCModule(c_module);
  module->SetNapiModuleCreator(&extension::ScintillaExtensionModuleMethodsBinder);
  return c_module;
}
