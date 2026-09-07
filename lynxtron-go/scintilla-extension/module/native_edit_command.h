#ifndef EXTENSION_NATIVE_EDIT_COMMAND_H_
#define EXTENSION_NATIVE_EDIT_COMMAND_H_

#include <string>

namespace extension {
// Called on the desktop UI thread; never redirects focus to another editor.
bool ExecuteFocusedEditCommand(const std::string& command);
}

#endif
