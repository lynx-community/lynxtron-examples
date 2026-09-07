// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#pragma once

#include <cstdint>
#include <string>

#include "scintilla/include/Scintilla.h"

namespace extension {

// Run on the platform's editor thread through its native message adapter.
// Repeated host pushes must preserve styles, selection, scroll and undo/redo.
template <typename Send>
bool LoadEditorDocument(const std::string& text, Send send) {
  const auto length = send(SCI_GETTEXTLENGTH, 0, 0);
  if (length >= 0 && static_cast<size_t>(length) == text.size()) {
    std::string current(text.size() + 1, '\0');
    send(SCI_GETTEXT, current.size(), reinterpret_cast<intptr_t>(current.data()));
    current.resize(text.size());
    if (current == text) return false;
  }

  // A host replacement is a document load, not a user edit. Neither the
  // inserted file nor the previous document belongs in the new undo history.
  send(SCI_SETTEXT, 0, reinterpret_cast<intptr_t>(text.c_str()));
  send(SCI_EMPTYUNDOBUFFER, 0, 0);
  send(SCI_SETSAVEPOINT, 0, 0);
  return true;
}

}  // namespace extension
