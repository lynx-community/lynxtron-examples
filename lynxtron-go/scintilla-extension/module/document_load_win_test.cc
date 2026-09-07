// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#include <windows.h>

#include <iostream>
#include <stdexcept>

#include "module/document_load.h"

extern "C" int Scintilla_RegisterClasses(void* instance);

int main() {
  HWND editor = nullptr;
  try {
    auto require = [](bool value, const char* description) {
      if (!value) throw std::runtime_error(description);
    };
    require(Scintilla_RegisterClasses(GetModuleHandleW(nullptr)), "register Scintilla");
    editor = CreateWindowExW(0, L"Scintilla", L"", WS_POPUP, 0, 0, 640, 480,
                             nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
    require(editor != nullptr, "create real Scintilla editor");
    auto send = [editor](unsigned int message, uintptr_t wparam, intptr_t lparam) -> intptr_t {
      return SendMessageW(editor, message, wparam, lparam);
    };
    auto content = [&]() {
      std::string value(static_cast<size_t>(send(SCI_GETTEXTLENGTH, 0, 0)) + 1, '\0');
      send(SCI_GETTEXT, value.size(), reinterpret_cast<intptr_t>(value.data()));
      value.pop_back();
      return value;
    };
    const std::string baseline = "const value = 1;";
    // Demonstrate the original failure with the actual editor, not a mock.
    send(SCI_SETTEXT, 0, reinterpret_cast<intptr_t>(baseline.c_str()));
    send(SCI_UNDO, 0, 0);
    require(content().empty(), "raw SETTEXT can undo the untouched document to empty");

    require(extension::LoadEditorDocument(baseline, send), "load baseline");
    require(!send(SCI_CANUNDO, 0, 0) && !send(SCI_CANREDO, 0, 0), "fresh load has no history");
    require(!send(SCI_GETMODIFY, 0, 0), "fresh load is a save point");
    send(SCI_UNDO, 0, 0);
    require(content() == baseline, "undo untouched content is harmless");

    const std::string edit = " // user edit";
    send(SCI_APPENDTEXT, edit.size(), reinterpret_cast<intptr_t>(edit.c_str()));
    require(!extension::LoadEditorDocument(baseline + edit, send), "identical push is a no-op");
    require(send(SCI_CANUNDO, 0, 0), "identical push preserves user undo");
    send(SCI_UNDO, 0, 0);
    require(content() == baseline, "user edit can be undone");
    require(!extension::LoadEditorDocument(baseline, send), "identical push after undo is a no-op");
    require(send(SCI_CANREDO, 0, 0), "identical push preserves redo");
    send(SCI_REDO, 0, 0);
    require(content() == baseline + edit, "user edit can be redone");

    const std::string replacement = "// \xe4\xb8\xad\xe6\x96\x87\xf0\x9f\x98\x80";
    require(extension::LoadEditorDocument(replacement, send), "replace document with UTF-8 text");
    require(!send(SCI_CANUNDO, 0, 0) && !send(SCI_CANREDO, 0, 0), "replacement discards old history");
    send(SCI_UNDO, 0, 0);
    require(content() == replacement, "undo cannot cross into the previous document");
    require(extension::LoadEditorDocument("", send), "load empty document");
    require(!send(SCI_CANUNDO, 0, 0) && !send(SCI_GETMODIFY, 0, 0), "empty load also resets history");
    DestroyWindow(editor);
    std::cout << "Document load/undo/redo regression checks passed\n";
    return 0;
  } catch (const std::exception& error) {
    if (editor) DestroyWindow(editor);
    std::cerr << error.what() << '\n';
    return 1;
  }
}
