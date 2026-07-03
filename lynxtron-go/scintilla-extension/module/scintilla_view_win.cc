// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#include "module/scintilla_view.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include <windows.h>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>
#include <mutex>
#include <string>
#include <tuple>
#include <vector>

#include "scintilla/include/Scintilla.h"

extern "C" int Scintilla_RegisterClasses(void* hInstance);

#ifndef SCI_SETLEXER
#define SCI_SETLEXER 4001
#endif

#ifndef SCLEX_CONTAINER
#define SCLEX_CONTAINER 0
#endif

namespace extension {
namespace {

constexpr int kScintillaControlId = 0x5C1;
constexpr UINT_PTR kRestoreRevealTimerId = 0x5C10;
constexpr UINT kRestoreRevealDelayMs = 160;
constexpr wchar_t kHostWindowClassName[] = L"LynxtronScintillaHost";
constexpr COLORREF kEditorBackgroundColor = RGB(30, 30, 30);

std::mutex g_window_mutex;
std::map<HWND, ScintillaView*> g_views_by_hwnd;
std::map<HWND, ScintillaView*> g_views_by_host_hwnd;
std::map<HWND, std::vector<ScintillaView*>> g_views_by_parent_hwnd;
std::map<HWND, WNDPROC> g_parent_wndprocs;
std::map<HWND, bool> g_parent_was_minimized;
std::map<HWND, bool> g_parent_restore_reveal_pending;
bool g_scintilla_classes_registered = false;
bool g_host_class_registered = false;
HMODULE g_scintilla_module_handle = nullptr;

LRESULT CALLBACK ParentWndProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam);

HWND AsHwnd(void* handle) {
  return static_cast<HWND>(handle);
}

LPARAM AsLParam(const char* value) {
  return reinterpret_cast<LPARAM>(value);
}

void DebugLog(const std::string& message) {
#ifdef LYNXTRON_SCINTILLA_DEBUG
  wchar_t temp_path[MAX_PATH] = {};
  DWORD length = ::GetTempPathW(MAX_PATH, temp_path);
  if (length == 0 || length >= MAX_PATH) return;

  std::wstring path(temp_path);
  path += L"lynxtron_scintilla_win.log";

  SYSTEMTIME now{};
  ::GetSystemTime(&now);
  char prefix[64] = {};
  std::snprintf(prefix,
                sizeof(prefix),
                "[%02u:%02u:%02u.%03u] ",
                now.wHour,
                now.wMinute,
                now.wSecond,
                now.wMilliseconds);

  std::string line(prefix);
  line += message;
  line += "\r\n";

  HANDLE file = ::CreateFileW(path.c_str(),
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

LRESULT SciSend(HWND hwnd, UINT message, WPARAM wparam = 0, LPARAM lparam = 0) {
  if (!hwnd) return 0;
  return ::SendMessageW(hwnd, message, wparam, lparam);
}

void RedrawEditorWindow(HWND hwnd) {
  if (!hwnd) return;
  ::RedrawWindow(hwnd,
                 nullptr,
                 nullptr,
                 RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW);
  ::UpdateWindow(hwnd);
}

void RedrawHostAndEditor(HWND host) {
  if (!host) return;
  HWND child = ::GetWindow(host, GW_CHILD);
  ::RedrawWindow(host,
                 nullptr,
                 nullptr,
                 RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW);
  if (child) RedrawEditorWindow(child);
}

void RestoreParentSubclassIfUnused(HWND parent) {
  auto views_it = g_views_by_parent_hwnd.find(parent);
  if (views_it != g_views_by_parent_hwnd.end() && !views_it->second.empty()) {
    return;
  }

  auto proc_it = g_parent_wndprocs.find(parent);
  if (proc_it == g_parent_wndprocs.end()) return;

  if (::IsWindow(parent) &&
      reinterpret_cast<WNDPROC>(::GetWindowLongPtrW(parent, GWLP_WNDPROC)) == ParentWndProc) {
    ::SetWindowLongPtrW(parent,
                        GWLP_WNDPROC,
                        reinterpret_cast<LONG_PTR>(proc_it->second));
  }
  g_parent_wndprocs.erase(proc_it);
}

void TrackViewParent(ScintillaView* view, HWND old_parent, HWND new_parent) {
  if (old_parent == new_parent) return;

  std::lock_guard<std::mutex> lock(g_window_mutex);
  if (old_parent) {
    auto old_it = g_views_by_parent_hwnd.find(old_parent);
    if (old_it != g_views_by_parent_hwnd.end()) {
      auto& views = old_it->second;
      views.erase(std::remove(views.begin(), views.end(), view), views.end());
      if (views.empty()) {
        g_views_by_parent_hwnd.erase(old_it);
        RestoreParentSubclassIfUnused(old_parent);
      }
    }
  }

  if (!new_parent) return;

  auto& views = g_views_by_parent_hwnd[new_parent];
  if (std::find(views.begin(), views.end(), view) == views.end()) {
    views.push_back(view);
  }

  if (g_parent_wndprocs.find(new_parent) == g_parent_wndprocs.end()) {
    LONG_PTR previous = ::SetWindowLongPtrW(new_parent,
                                            GWLP_WNDPROC,
                                            reinterpret_cast<LONG_PTR>(ParentWndProc));
    if (previous != 0) {
      g_parent_wndprocs[new_parent] = reinterpret_cast<WNDPROC>(previous);
    }
  }
}

std::vector<ScintillaView*> ViewsForParent(HWND parent) {
  std::lock_guard<std::mutex> lock(g_window_mutex);
  auto it = g_views_by_parent_hwnd.find(parent);
  if (it == g_views_by_parent_hwnd.end()) return {};
  return it->second;
}

WNDPROC OriginalParentWndProc(HWND parent) {
  std::lock_guard<std::mutex> lock(g_window_mutex);
  auto it = g_parent_wndprocs.find(parent);
  return it == g_parent_wndprocs.end() ? nullptr : it->second;
}

void RepositionViewsForParent(HWND parent) {
  for (ScintillaView* view : ViewsForParent(parent)) {
    if (view) view->RepositionForParentMove();
  }
}

void HideViewsForParent(HWND parent) {
  for (ScintillaView* view : ViewsForParent(parent)) {
    if (view) view->HideForParentTransition();
  }
}

void SetParentWasMinimized(HWND parent, bool value) {
  std::lock_guard<std::mutex> lock(g_window_mutex);
  if (value) {
    g_parent_was_minimized[parent] = true;
  } else {
    g_parent_was_minimized.erase(parent);
  }
}

bool ConsumeParentWasMinimized(HWND parent) {
  std::lock_guard<std::mutex> lock(g_window_mutex);
  auto it = g_parent_was_minimized.find(parent);
  const bool was_minimized = it != g_parent_was_minimized.end() && it->second;
  if (it != g_parent_was_minimized.end()) {
    g_parent_was_minimized.erase(it);
  }
  return was_minimized;
}

void SetParentRestoreRevealPending(HWND parent, bool value) {
  std::lock_guard<std::mutex> lock(g_window_mutex);
  if (value) {
    g_parent_restore_reveal_pending[parent] = true;
  } else {
    g_parent_restore_reveal_pending.erase(parent);
  }
}

bool ShouldHoldHostHidden(HWND parent) {
  std::lock_guard<std::mutex> lock(g_window_mutex);
  auto minimized_it = g_parent_was_minimized.find(parent);
  if (minimized_it != g_parent_was_minimized.end() && minimized_it->second) return true;
  auto pending_it = g_parent_restore_reveal_pending.find(parent);
  return pending_it != g_parent_restore_reveal_pending.end() && pending_it->second;
}

ScintillaView* ViewForHost(HWND host) {
  std::lock_guard<std::mutex> lock(g_window_mutex);
  auto it = g_views_by_host_hwnd.find(host);
  return it == g_views_by_host_hwnd.end() ? nullptr : it->second;
}

void ConfigureScintilla(HWND hwnd) {
  SciSend(hwnd, SCI_SETTECHNOLOGY, SC_TECHNOLOGY_DEFAULT, 0);
  SciSend(hwnd, SCI_SETBUFFEREDDRAW, 0, 0);
  SciSend(hwnd, SCI_SETPHASESDRAW, SC_PHASES_ONE, 0);
  SciSend(hwnd, SCI_SETLAYOUTCACHE, SC_CACHE_NONE, 0);
  SciSend(hwnd, SCI_SETCODEPAGE, SC_CP_UTF8, 0);
  SciSend(hwnd, SCI_SETLEXER, SCLEX_CONTAINER, 0);

  const char* font = "Consolas";
  SciSend(hwnd, SCI_STYLESETFONT, STYLE_DEFAULT, AsLParam(font));
  SciSend(hwnd, SCI_STYLESETSIZE, STYLE_DEFAULT, 14);
  SciSend(hwnd, SCI_STYLESETBACK, STYLE_DEFAULT, 0x1E1E1E);
  SciSend(hwnd, SCI_STYLESETFORE, STYLE_DEFAULT, 0xD4D4D4);
  SciSend(hwnd, SCI_STYLECLEARALL, 0, 0);

  SciSend(hwnd, SCI_STYLESETFORE, 0, 0xD4D4D4);
  SciSend(hwnd, SCI_STYLESETFORE, 1, 0xD69C56);
  SciSend(hwnd, SCI_STYLESETBOLD, 1, 1);
  SciSend(hwnd, SCI_STYLESETFORE, 2, 0x7891CE);
  SciSend(hwnd, SCI_STYLESETFORE, 3, 0x55996A);
  SciSend(hwnd, SCI_STYLESETFORE, 4, 0xA8CEB5);
  SciSend(hwnd, SCI_STYLESETFORE, 5, 0xB0C94E);

  SciSend(hwnd, SCI_SETMARGINTYPEN, 0, SC_MARGIN_NUMBER);
  SciSend(hwnd, SCI_SETMARGINWIDTHN, 0, 50);
  SciSend(hwnd, SCI_STYLESETFORE, STYLE_LINENUMBER, 0x858585);
  SciSend(hwnd, SCI_STYLESETBACK, STYLE_LINENUMBER, 0x1E1E1E);

  SciSend(hwnd, SCI_SETCARETFORE, 0xADAFAE, 0);
  SciSend(hwnd, SCI_SETSELBACK, 1, 0xBB6A26);
  SciSend(hwnd, SCI_SETTABWIDTH, 4, 0);
  SciSend(hwnd, SCI_SETSCROLLWIDTHTRACKING, 1, 0);
  SciSend(hwnd, SCI_SETSCROLLWIDTH, 2000, 0);

  SciSend(hwnd, SCI_SETMOUSEDWELLTIME, 600, 0);
  SciSend(hwnd, SCI_CALLTIPSETBACK, 0x262525, 0);
  SciSend(hwnd, SCI_CALLTIPSETFORE, 0xD4D4D4, 0);

  for (int ind = 0; ind < 3; ind++) {
    SciSend(hwnd, SCI_INDICSETSTYLE, ind, INDIC_SQUIGGLELOW);
    SciSend(hwnd, SCI_INDICSETUNDER, ind, 0);
    SciSend(hwnd, SCI_INDICSETSTROKEWIDTH, ind, 200);
  }
  SciSend(hwnd, SCI_INDICSETFORE, 0, 0x3232FA);
  SciSend(hwnd, SCI_INDICSETFORE, 1, 0x00BBFF);
  SciSend(hwnd, SCI_INDICSETFORE, 2, 0xFF8800);
}

BOOL CALLBACK FindMainWindowProc(HWND hwnd, LPARAM lparam) {
  DWORD window_pid = 0;
  ::GetWindowThreadProcessId(hwnd, &window_pid);
  if (window_pid != ::GetCurrentProcessId()) return TRUE;
  if (!::IsWindowVisible(hwnd)) return TRUE;
  if (::GetWindow(hwnd, GW_OWNER) != nullptr) return TRUE;

  RECT rect{};
  if (!::GetClientRect(hwnd, &rect)) return TRUE;
  const int width = rect.right - rect.left;
  const int height = rect.bottom - rect.top;
  if (width <= 0 || height <= 0) return TRUE;

  *reinterpret_cast<HWND*>(lparam) = hwnd;
  return FALSE;
}

HWND FindMainWindow() {
  HWND foreground = ::GetForegroundWindow();
  if (foreground) {
    DWORD pid = 0;
    ::GetWindowThreadProcessId(foreground, &pid);
    if (pid == ::GetCurrentProcessId() && ::GetWindow(foreground, GW_OWNER) == nullptr) {
      return foreground;
    }
  }

  HWND hwnd = nullptr;
  ::EnumWindows(FindMainWindowProc, reinterpret_cast<LPARAM>(&hwnd));
  return hwnd;
}

void DispatchScintillaNotification(SCNotification* notification) {
  if (!notification) return;

  ScintillaView* view = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_window_mutex);
    auto it = g_views_by_hwnd.find(static_cast<HWND>(notification->nmhdr.hwndFrom));
    if (it != g_views_by_hwnd.end()) view = it->second;
  }

  if (!view) return;

  if (notification->nmhdr.code == SCN_MODIFIED &&
      (notification->modificationType & (SC_MOD_INSERTTEXT | SC_MOD_DELETETEXT))) {
    view->OnContentModified();
  } else if (notification->nmhdr.code == SCN_DWELLSTART) {
    view->OnDwellStart(static_cast<int>(notification->position),
                       notification->x,
                       notification->y);
  } else if (notification->nmhdr.code == SCN_DWELLEND) {
    view->OnDwellEnd();
  }
}

LRESULT CALLBACK ParentWndProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  const bool should_reposition =
      message == WM_WINDOWPOSCHANGED || message == WM_MOVE || message == WM_MOVING ||
      message == WM_SIZE || message == WM_SIZING || message == WM_SHOWWINDOW ||
      message == WM_EXITSIZEMOVE;

  if (message == WM_SIZE && wparam == SIZE_MINIMIZED) {
    SetParentWasMinimized(hwnd, true);
    SetParentRestoreRevealPending(hwnd, false);
    ::KillTimer(hwnd, kRestoreRevealTimerId);
    HideViewsForParent(hwnd);
  }

  WNDPROC original = OriginalParentWndProc(hwnd);
  LRESULT result = original
                       ? ::CallWindowProcW(original, hwnd, message, wparam, lparam)
                       : ::DefWindowProcW(hwnd, message, wparam, lparam);

  if (message == WM_NCDESTROY) {
    std::lock_guard<std::mutex> lock(g_window_mutex);
    g_views_by_parent_hwnd.erase(hwnd);
    g_parent_wndprocs.erase(hwnd);
    g_parent_was_minimized.erase(hwnd);
    g_parent_restore_reveal_pending.erase(hwnd);
    ::KillTimer(hwnd, kRestoreRevealTimerId);
    return result;
  }

  if (message == WM_TIMER && wparam == kRestoreRevealTimerId) {
    ::KillTimer(hwnd, kRestoreRevealTimerId);
    SetParentRestoreRevealPending(hwnd, false);
    if (!::IsWindowVisible(hwnd) || ::IsIconic(hwnd)) {
      SetParentWasMinimized(hwnd, true);
      HideViewsForParent(hwnd);
      return result;
    }
    RepositionViewsForParent(hwnd);
    return result;
  }

  if (message == WM_SIZE &&
      (wparam == SIZE_RESTORED || wparam == SIZE_MAXIMIZED) &&
      ConsumeParentWasMinimized(hwnd)) {
    SetParentRestoreRevealPending(hwnd, true);
    HideViewsForParent(hwnd);
    ::SetTimer(hwnd, kRestoreRevealTimerId, kRestoreRevealDelayMs, nullptr);
  }

  if (should_reposition) {
    RepositionViewsForParent(hwnd);
  }

  return result;
}

LRESULT CALLBACK HostWndProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_NOTIFY && lparam != 0) {
    DispatchScintillaNotification(reinterpret_cast<SCNotification*>(lparam));
  } else if (message == WM_SIZE) {
    HWND child = ::GetWindow(hwnd, GW_CHILD);
    if (child) {
      ::SetWindowPos(child,
                     nullptr,
                     0,
                     0,
                     LOWORD(lparam),
                     HIWORD(lparam),
                     SWP_NOZORDER | SWP_NOACTIVATE);
      RedrawEditorWindow(child);
    }
  } else if (message == WM_ERASEBKGND) {
    RECT rect{};
    ::GetClientRect(hwnd, &rect);
    HBRUSH brush = ::CreateSolidBrush(kEditorBackgroundColor);
    if (brush) {
      ::FillRect(reinterpret_cast<HDC>(wparam), &rect, brush);
      ::DeleteObject(brush);
    }
    return 1;
  } else if (message == WM_PAINT) {
    PAINTSTRUCT ps{};
    HDC dc = ::BeginPaint(hwnd, &ps);
    if (dc) {
      HBRUSH brush = ::CreateSolidBrush(kEditorBackgroundColor);
      if (brush) {
        ::FillRect(dc, &ps.rcPaint, brush);
        ::DeleteObject(brush);
      }
    }
    ::EndPaint(hwnd, &ps);
    RedrawEditorWindow(::GetWindow(hwnd, GW_CHILD));
    return 0;
  } else if (message == WM_SETFOCUS) {
    HWND child = ::GetWindow(hwnd, GW_CHILD);
    if (child) ::SetFocus(child);
  } else if (message == WM_KILLFOCUS) {
    RedrawHostAndEditor(hwnd);
  } else if (message == WM_SHOWWINDOW && wparam) {
    ScintillaView* view = ViewForHost(hwnd);
    if (view && view->ShouldStayHiddenForParentTransition()) {
      ::ShowWindow(hwnd, SW_HIDE);
      return 0;
    }
    RedrawHostAndEditor(hwnd);
  } else if (message == WM_WINDOWPOSCHANGED) {
    RedrawHostAndEditor(hwnd);
  } else if (message == WM_NCDESTROY) {
    std::lock_guard<std::mutex> lock(g_window_mutex);
    g_views_by_host_hwnd.erase(hwnd);
  }

  return ::DefWindowProcW(hwnd, message, wparam, lparam);
}

bool EnsureScintillaClassesRegistered() {
  if (g_scintilla_classes_registered) return true;
  DebugLog("EnsureScintillaClassesRegistered: begin");
  HMODULE module = nullptr;
  if (!::GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                                GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                            reinterpret_cast<LPCWSTR>(&EnsureScintillaClassesRegistered),
                            &module)) {
    module = ::GetModuleHandleW(nullptr);
  }
  g_scintilla_module_handle = module;
  g_scintilla_classes_registered = Scintilla_RegisterClasses(module) != 0;
  DebugLog(std::string("EnsureScintillaClassesRegistered: result=") +
           (g_scintilla_classes_registered ? "true" : "false"));
  return g_scintilla_classes_registered;
}

bool EnsureHostWindowClassRegistered() {
  if (g_host_class_registered) return true;
  if (!EnsureScintillaClassesRegistered()) return false;
  DebugLog("EnsureHostWindowClassRegistered: begin");

  HMODULE module = g_scintilla_module_handle ? g_scintilla_module_handle : ::GetModuleHandleW(nullptr);
  WNDCLASSEXW wc{};
  wc.cbSize = sizeof(wc);
  wc.style = CS_HREDRAW | CS_VREDRAW;
  wc.lpfnWndProc = HostWndProc;
  wc.hInstance = module;
  wc.hCursor = ::LoadCursorW(nullptr, MAKEINTRESOURCEW(32513));
  wc.hbrBackground = nullptr;
  wc.lpszClassName = kHostWindowClassName;

  ATOM atom = ::RegisterClassExW(&wc);
  if (atom != 0 || ::GetLastError() == ERROR_CLASS_ALREADY_EXISTS) {
    g_host_class_registered = true;
    DebugLog("EnsureHostWindowClassRegistered: registered");
    return true;
  }
  DebugLog("EnsureHostWindowClassRegistered: failed lastError=" +
           std::to_string(::GetLastError()));
  return false;
}

int RoundLayoutValue(float value) {
  return static_cast<int>(std::lround(value));
}

int ScaleLayoutValue(float value, float pixel_ratio) {
  const float scale = pixel_ratio > 0.0f ? pixel_ratio : 1.0f;
  return RoundLayoutValue(value * scale);
}

void PositionOwnedPopup(HWND parent, HWND host, int x, int y, int width, int height) {
  POINT origin{x, y};
  ::ClientToScreen(parent, &origin);
  if (::GetWindow(host, GW_OWNER) != parent) {
    ::SetWindowLongPtrW(host, GWLP_HWNDPARENT, reinterpret_cast<LONG_PTR>(parent));
  }
  ::SetWindowPos(host,
                 HWND_TOP,
                 origin.x,
                 origin.y,
                 width,
                 height,
                 SWP_SHOWWINDOW | SWP_NOACTIVATE);
}

}  // namespace

ScintillaView::ScintillaView() {
  DebugLog("ScintillaView ctor");
  EnsureScintillaClassesRegistered();
}

ScintillaView::~ScintillaView() {
  DebugLog("ScintillaView dtor");
  if (!editor_id_.empty()) {
    ScintillaRegistry::Get().Unregister(editor_id_, this);
  }

  HWND host = AsHwnd(win_host_);
  HWND hwnd = AsHwnd(win_view_);
  HWND parent = AsHwnd(win_parent_);
  win_host_ = nullptr;
  win_view_ = nullptr;
  win_parent_ = nullptr;
  if (parent) {
    TrackViewParent(this, parent, nullptr);
  }
  if (host || hwnd) {
    std::lock_guard<std::mutex> lock(g_window_mutex);
    if (host) g_views_by_host_hwnd.erase(host);
    if (hwnd) g_views_by_hwnd.erase(hwnd);
  }
  if (host) {
    ::DestroyWindow(host);
  } else if (hwnd) {
    ::DestroyWindow(hwnd);
  }
}

void ScintillaView::OnPropertiesChanged(const lynx::pub::LynxValue& attrs,
                                        const lynx::pub::LynxValue& events) {
  DebugLog("OnPropertiesChanged");
  if (attrs.HasProperty("editor-id")) {
    std::string new_id = attrs.GetProperty("editor-id").StdString();
    DebugLog("OnPropertiesChanged editor-id=" + new_id);
    if (new_id != editor_id_) {
      if (!editor_id_.empty()) ScintillaRegistry::Get().Unregister(editor_id_, this);
      editor_id_ = new_id;
      ScintillaRegistry::Get().Register(editor_id_, this);
    }
  }

  if (attrs.HasProperty("content")) {
    std::string content = attrs.GetProperty("content").StdString();
    DebugLog("OnPropertiesChanged content length=" + std::to_string(content.size()));
    SetContent(content.data(), content.size());
  }
}

void ScintillaView::OnLayoutChanged(float left, float top, float width, float height,
                                    float pixel_ratio) {
  DebugLog("OnLayoutChanged left=" + std::to_string(left) +
           " top=" + std::to_string(top) +
           " width=" + std::to_string(width) +
           " height=" + std::to_string(height) +
           " pixelRatio=" + std::to_string(pixel_ratio) +
           " thread=" + std::to_string(::GetCurrentThreadId()));
  UpdateLayoutPosition(left, top);

  HWND parent = FindMainWindow();
  DebugLog("OnLayoutChanged parent=" + std::to_string(reinterpret_cast<uintptr_t>(parent)));
  if (!parent) return;

  const int x = ScaleLayoutValue(left, pixel_ratio);
  const int y = ScaleLayoutValue(top, pixel_ratio);
  const int w = std::max(0, ScaleLayoutValue(width, pixel_ratio));
  const int h = std::max(0, ScaleLayoutValue(height, pixel_ratio));
  HWND previous_parent = AsHwnd(win_parent_);
  win_parent_ = parent;
  win_layout_x_ = x;
  win_layout_y_ = y;
  win_layout_width_ = w;
  win_layout_height_ = h;
  TrackViewParent(this, previous_parent, parent);

  HWND host = AsHwnd(win_host_);
  if (!host) {
    DebugLog("OnLayoutChanged create host begin");
    if (!EnsureHostWindowClassRegistered()) return;
    HMODULE module = g_scintilla_module_handle ? g_scintilla_module_handle : ::GetModuleHandleW(nullptr);
    POINT origin{x, y};
    ::ClientToScreen(parent, &origin);
    host = ::CreateWindowExW(WS_EX_TOOLWINDOW,
                             kHostWindowClassName,
                             L"",
                             WS_POPUP | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
                             origin.x,
                             origin.y,
                             std::max(1, w),
                             std::max(1, h),
                             parent,
                             nullptr,
                             module,
                             nullptr);
    if (!host) {
      DebugLog("OnLayoutChanged create host failed lastError=" + std::to_string(::GetLastError()));
      return;
    }
    DebugLog("OnLayoutChanged create host success");
    win_host_ = host;
    {
      std::lock_guard<std::mutex> lock(g_window_mutex);
      g_views_by_host_hwnd[host] = this;
    }
  } else if (::GetWindow(host, GW_OWNER) != parent) {
    ::SetWindowLongPtrW(host, GWLP_HWNDPARENT, reinterpret_cast<LONG_PTR>(parent));
  }

  HWND hwnd = AsHwnd(win_view_);
  if (!hwnd) {
    DebugLog("OnLayoutChanged create scintilla begin");
    if (!EnsureScintillaClassesRegistered()) return;
    HMODULE module = g_scintilla_module_handle ? g_scintilla_module_handle : ::GetModuleHandleW(nullptr);
    hwnd = ::CreateWindowExW(0,
                             L"Scintilla",
                             L"",
                             WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
                             0,
                             0,
                             std::max(1, w),
                             std::max(1, h),
                             host,
                             reinterpret_cast<HMENU>(static_cast<INT_PTR>(kScintillaControlId)),
                             module,
                             nullptr);
    if (!hwnd) {
      DebugLog("OnLayoutChanged create scintilla failed lastError=" + std::to_string(::GetLastError()));
      return;
    }
    DebugLog("OnLayoutChanged create scintilla success");
    DebugLog("OnLayoutChanged configure begin");
    ConfigureScintilla(hwnd);
    DebugLog("OnLayoutChanged configure done");
    win_view_ = hwnd;
    {
      std::lock_guard<std::mutex> lock(g_window_mutex);
      g_views_by_hwnd[hwnd] = this;
    }
    std::string text;
    bool has_content = false;
    {
      std::lock_guard<std::mutex> lock(content_mutex_);
      has_content = has_pending_content_;
      if (has_content) {
        text = pending_content_;
        pending_content_.clear();
        has_pending_content_ = false;
      }
    }
    if (has_content) {
      SciSend(hwnd, SCI_SETTEXT, 0, AsLParam(text.c_str()));
      RedrawEditorWindow(hwnd);
      DebugLog("OnLayoutChanged applied pending content length=" + std::to_string(text.size()));
    }
  }

  PositionOwnedPopup(parent, host, x, y, w, h);
  ::SetWindowPos(hwnd, HWND_TOP, 0, 0, w, h, SWP_SHOWWINDOW | SWP_NOACTIVATE);
  RedrawHostAndEditor(host);
  std::string text;
  bool has_content = false;
  {
    std::lock_guard<std::mutex> lock(content_mutex_);
    has_content = has_pending_content_;
    if (has_content) {
      text = pending_content_;
      pending_content_.clear();
      has_pending_content_ = false;
    }
  }
  if (has_content) {
    SciSend(hwnd, SCI_SETTEXT, 0, AsLParam(text.c_str()));
    RedrawEditorWindow(hwnd);
    DebugLog("OnLayoutChanged applied pending content after layout length=" +
             std::to_string(text.size()));
  }
  DebugLog("OnLayoutChanged done");
}

void ScintillaView::DetachFromWindow() {
  HWND parent = AsHwnd(win_parent_);
  HWND host = AsHwnd(win_host_);
  HWND hwnd = AsHwnd(win_view_);

  if (hwnd && ::IsWindow(hwnd)) {
    SciSend(hwnd, SCI_CALLTIPCANCEL, 0, 0);
  }

  if (parent) {
    TrackViewParent(this, parent, nullptr);
    win_parent_ = nullptr;
  }

  if (host && ::IsWindow(host)) {
    ::ShowWindow(host, SW_HIDE);
    if (::GetWindow(host, GW_OWNER)) {
      ::SetWindowLongPtrW(host, GWLP_HWNDPARENT, 0);
    }
  }
}

void ScintillaView::RepositionForParentMove() {
  HWND parent = AsHwnd(win_parent_);
  HWND host = AsHwnd(win_host_);
  if (!parent || !host || !::IsWindow(parent) || !::IsWindow(host)) return;

  if (ShouldStayHiddenForParentTransition()) {
    ::ShowWindow(host, SW_HIDE);
    return;
  }

  const int width = std::max(1, win_layout_width_);
  const int height = std::max(1, win_layout_height_);
  PositionOwnedPopup(parent, host, win_layout_x_, win_layout_y_, width, height);

  HWND hwnd = AsHwnd(win_view_);
  if (hwnd && ::IsWindow(hwnd)) {
    ::SetWindowPos(hwnd,
                   HWND_TOP,
                   0,
                   0,
                   width,
                   height,
                   SWP_SHOWWINDOW | SWP_NOACTIVATE);
  }
  RedrawHostAndEditor(host);
}

void ScintillaView::HideForParentTransition() {
  HWND host = AsHwnd(win_host_);
  if (host && ::IsWindow(host)) {
    ::ShowWindow(host, SW_HIDE);
    if (::GetWindow(host, GW_OWNER)) {
      ::SetWindowLongPtrW(host, GWLP_HWNDPARENT, 0);
    }
  }
}

bool ScintillaView::ShouldStayHiddenForParentTransition() const {
  HWND parent = AsHwnd(win_parent_);
  if (!parent || !::IsWindow(parent)) return true;
  return !::IsWindowVisible(parent) || ::IsIconic(parent) || ShouldHoldHostHidden(parent);
}

void ScintillaView::OnMotionEvent(native_view_motion_event_t* event) {
}

void ScintillaView::SetContent(const char* data, size_t length) {
  DebugLog("SetContent length=" + std::to_string(length));
  HWND hwnd = AsHwnd(win_view_);
  DebugLog("SetContent hwnd=" + std::to_string(reinterpret_cast<uintptr_t>(hwnd)));
  std::string text(data, length);
  {
    std::lock_guard<std::mutex> lock(content_mutex_);
    pending_content_ = text;
    has_pending_content_ = true;
  }
  if (!hwnd) {
    return;
  }
  SciSend(hwnd, SCI_SETTEXT, 0, AsLParam(text.c_str()));
  RedrawEditorWindow(hwnd);
  {
    std::lock_guard<std::mutex> lock(content_mutex_);
    pending_content_.clear();
    has_pending_content_ = false;
  }
}

std::string ScintillaView::GetContent() {
  HWND hwnd = AsHwnd(win_view_);
  if (!hwnd) return "";

  const auto length = static_cast<size_t>(SciSend(hwnd, SCI_GETTEXTLENGTH));
  std::string text(length + 1, '\0');
  SciSend(hwnd, SCI_GETTEXT, length + 1, reinterpret_cast<LPARAM>(text.data()));
  text.resize(length);
  return text;
}

void ScintillaView::ApplyStyles(int startPos, const char* styles, size_t length) {
  DebugLog("ApplyStyles start=" + std::to_string(startPos) +
           " length=" + std::to_string(length));
  HWND hwnd = AsHwnd(win_view_);
  if (!hwnd) {
    DebugLog("ApplyStyles skipped because hwnd is not ready");
    return;
  }
  std::string style_data(styles, length);
  SciSend(hwnd, SCI_STARTSTYLING, startPos, 0);
  SciSend(hwnd, SCI_SETSTYLINGEX, length, AsLParam(style_data.data()));
  RedrawEditorWindow(hwnd);
}

void ScintillaView::UpdateLayoutPosition(float left, float top) {
  std::lock_guard<std::mutex> lock(dwell_mutex_);
  layout_left_ = left;
  layout_top_ = top;
}

void ScintillaView::OnDwellStart(int bytePos, int x, int y) {
  std::lock_guard<std::mutex> lock(dwell_mutex_);
  dwell_info_ = {true, bytePos, layout_left_ + static_cast<float>(x),
                 layout_top_ + static_cast<float>(y)};
}

void ScintillaView::OnDwellEnd() {
  std::lock_guard<std::mutex> lock(dwell_mutex_);
  dwell_info_ = {false, -1, 0.0f, 0.0f};
}

ScintillaView::DwellInfo ScintillaView::GetDwellInfo() const {
  std::lock_guard<std::mutex> lock(dwell_mutex_);
  return dwell_info_;
}

void ScintillaView::ShowCalltip(int bytePos, const std::string& text) {
  HWND hwnd = AsHwnd(win_view_);
  if (!hwnd) return;
  SciSend(hwnd, SCI_CALLTIPSHOW, bytePos, AsLParam(text.c_str()));
}

void ScintillaView::HideCalltip() {
  SciSend(AsHwnd(win_view_), SCI_CALLTIPCANCEL, 0, 0);
}

void ScintillaView::GotoLine(int line) {
  SciSend(AsHwnd(win_view_), SCI_GOTOLINE, line, 0);
}

void ScintillaView::SetSelection(int anchor, int caret) {
  SciSend(AsHwnd(win_view_), SCI_SETSEL, anchor, caret);
}

void ScintillaView::ScrollCaret() {
  SciSend(AsHwnd(win_view_), SCI_SCROLLCARET, 0, 0);
}

void ScintillaView::DetachFromWindow() {
  // Mirror macOS behavior: detach/hide the native editor view while preserving the
  // instance for a later layout pass to reattach.
  HWND hwnd = AsHwnd(win_view_);
  if (hwnd && ::IsWindow(hwnd)) {
    SciSend(hwnd, SCI_CALLTIPCANCEL, 0, 0);
    ::ShowWindow(hwnd, SW_HIDE);
  }

  HWND host = AsHwnd(win_host_);
  if (host && ::IsWindow(host)) {
    ::ShowWindow(host, SW_HIDE);
    if (::GetWindow(host, GW_OWNER)) {
      ::SetWindowLongPtrW(host, GWLP_HWNDPARENT, 0);
    }
  }
}

void ScintillaView::ClearIndicators() {
  HWND hwnd = AsHwnd(win_view_);
  if (!hwnd) return;
  const auto doc_len = SciSend(hwnd, SCI_GETTEXTLENGTH);
  for (int ind = 0; ind < 3; ind++) {
    SciSend(hwnd, SCI_SETINDICATORCURRENT, ind, 0);
    SciSend(hwnd, SCI_INDICATORCLEARRANGE, 0, doc_len);
  }
  RedrawEditorWindow(hwnd);
}

void ScintillaView::SetIndicators(const std::vector<std::tuple<int, int, int>>& ranges) {
  HWND hwnd = AsHwnd(win_view_);
  if (!hwnd) return;

  const auto doc_len = SciSend(hwnd, SCI_GETTEXTLENGTH);
  for (int ind = 0; ind < 3; ind++) {
    SciSend(hwnd, SCI_SETINDICATORCURRENT, ind, 0);
    SciSend(hwnd, SCI_INDICATORCLEARRANGE, 0, doc_len);
  }

  for (const auto& [start, length, style] : ranges) {
    if (style < 0 || style > 2 || length <= 0 || start < 0) continue;
    SciSend(hwnd, SCI_SETINDICATORCURRENT, style, 0);
    SciSend(hwnd, SCI_INDICATORFILLRANGE, start, length);
  }
  RedrawEditorWindow(hwnd);
}

bool ScintillaRegistry::CaptureWindowToFile(const std::string& output_path) {
  return false;
}

std::string ScintillaRegistry::CaptureWindowToBase64() {
  return "";
}

}  // namespace extension

LYNX_EXTERN_C lynx_native_view_t* scintilla_view_create_view(void* opaque) {
  auto* view = new extension::ScintillaView();
  return view->native_view();
}
