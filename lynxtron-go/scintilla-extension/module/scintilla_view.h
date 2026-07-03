// Copyright 2025 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#ifndef EXTENSION_SCINTILLA_VIEW_H_
#define EXTENSION_SCINTILLA_VIEW_H_

#include "lynx_native_view.h"
#include <string>
#include <vector>
#include <tuple>
#include <map>
#include <mutex>
#include <atomic>

namespace extension {

class ScintillaView : public lynx::pub::LynxNativeView {
 public:
  ScintillaView();
  ~ScintillaView();

  bool IsSurfaceEnabled() override { return false; } // Use a platform child view directly, not a surface.

  void OnPropertiesChanged(const lynx::pub::LynxValue& attrs,
                           const lynx::pub::LynxValue& events) override;
  
  void OnLayoutChanged(float left, float top, float width, float height,
                               float pixel_ratio) override;
                               
  void OnMotionEvent(native_view_motion_event_t* event) override;
  
  // Data Bridge
  void SetContent(const char* data, size_t length);
  std::string GetContent();
  void ApplyStyles(int startPos, const char* styles, size_t length);

  // Called from Scintilla's SCN_MODIFIED notification on the main thread.
  void OnContentModified() { content_changed_.store(true, std::memory_order_relaxed); }

  // Returns true and resets the flag if the editor content was modified since
  // the last call. Safe to call from any thread.
  bool ConsumeContentChanged() { return content_changed_.exchange(false, std::memory_order_relaxed); }

  // Diagnostic squiggle indicators.
  // Each range: (startByte, lengthBytes, style) where style 0=error,1=warning,2=info.
  // Clears all existing indicators then fills the supplied ranges.
  void SetIndicators(const std::vector<std::tuple<int,int,int>>& ranges);
  void ClearIndicators();

  // Hover dwell support.
  struct DwellInfo { bool active; int bytePos; float x; float y; };
  void UpdateLayoutPosition(float left, float top);
  void OnDwellStart(int bytePos, int x, int y);
  void OnDwellEnd();
  DwellInfo GetDwellInfo() const;

  // Calltip (native Scintilla hover popup).
  void ShowCalltip(int bytePos, const std::string& text);
  void HideCalltip();

  // Navigation: go to line (0-based), set selection (byte positions), scroll caret visible
  void GotoLine(int line);
  void SetSelection(int anchor, int caret);
  void ScrollCaret();
  void RepositionForParentMove();
  void HideForParentTransition();
  bool ShouldStayHiddenForParentTransition() const;

  // Detach the Cocoa editor view from the host window while preserving the
  // editor instance for a later layout pass to reattach it.
  void DetachFromWindow();

private:
  void* cocoa_view_ = nullptr; // Pointer to ScintillaCocoa (NSView)
  void* win_host_ = nullptr;   // Pointer to the Win32 child host HWND
  void* win_view_ = nullptr;   // Pointer to the Win32 Scintilla HWND
  void* win_parent_ = nullptr; // Pointer to the owner/main HWND for the Win32 overlay
  int win_layout_x_ = 0;
  int win_layout_y_ = 0;
  int win_layout_width_ = 0;
  int win_layout_height_ = 0;
  std::mutex content_mutex_;
  std::string pending_content_;
  bool has_pending_content_ = false;
  std::string editor_id_;
  std::atomic<bool> content_changed_{false};
  mutable std::mutex dwell_mutex_;
  DwellInfo dwell_info_{false, -1, 0.0f, 0.0f};
  float layout_left_ = 0.0f;
  float layout_top_ = 0.0f;
};

// Global Registry for N-API access
class ScintillaRegistry {
public:
    static ScintillaRegistry& Get() {
        static ScintillaRegistry instance;
        return instance;
    }
    
    void Register(const std::string& id, ScintillaView* view) {
        std::lock_guard<std::mutex> lock(mutex_);
        views_[id] = view;

        // Apply pending content first, then pending styles (order matters)
        auto cit = pending_content_.find(id);
        if (cit != pending_content_.end()) {
            view->SetContent(cit->second.data(), cit->second.size());
            pending_content_.erase(cit);
        }
        auto sit = pending_styles_.find(id);
        if (sit != pending_styles_.end()) {
            view->ApplyStyles(sit->second.startPos,
                              sit->second.data.data(),
                              sit->second.data.size());
            pending_styles_.erase(sit);
        }
    }

    void Unregister(const std::string& id, ScintillaView* view) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it == views_.end()) return;
        if (it->second == view) {
            views_.erase(it);
        }
    }
    
    // Returns true if content was set (either to view or pending)
    bool SetContent(const std::string& id, const char* data, size_t length) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it != views_.end()) {
            it->second->SetContent(data, length);
            return true;
        } else {
            // Store pending content
            pending_content_[id] = std::string(data, length);
            return true;
        }
    }
    
    // Apply styles to a view (or queue as pending if view not yet registered)
    bool ApplyStyles(const std::string& id, int startPos, const char* styles, size_t length) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it != views_.end()) {
            it->second->ApplyStyles(startPos, styles, length);
            return true;
        }
        // View not ready yet — store as pending, applied in Register()
        pending_styles_[id] = { startPos, std::string(styles, length) };
        return true;
    }
    
    ScintillaView* GetView(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it != views_.end()) {
            return it->second;
        }
        return nullptr;
    }

    bool ShowCalltip(const std::string& id, int bytePos, const std::string& text) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it == views_.end()) return false;
        it->second->ShowCalltip(bytePos, text);
        return true;
    }

    bool HideCalltip(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it == views_.end()) return false;
        it->second->HideCalltip();
        return true;
    }

    bool SetIndicators(const std::string& id,
                       const std::vector<std::tuple<int,int,int>>& ranges) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it == views_.end()) return false;
        it->second->SetIndicators(ranges);
        return true;
    }

    bool ClearIndicators(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it == views_.end()) return false;
        it->second->ClearIndicators();
        return true;
    }

    bool GotoLine(const std::string& id, int line) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it == views_.end()) return false;
        it->second->GotoLine(line);
        return true;
    }

    bool SetSelection(const std::string& id, int anchor, int caret) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it == views_.end()) return false;
        it->second->SetSelection(anchor, caret);
        return true;
    }

    bool ScrollCaret(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        if (it == views_.end()) return false;
        it->second->ScrollCaret();
        return true;
    }

    bool DetachFromWindow(const std::string& id) {
        ScintillaView* view = nullptr;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = views_.find(id);
            if (it == views_.end()) return false;
            view = it->second;
        }
        view->DetachFromWindow();
        return true;
    }

    // Capture the key window (including all native subviews) to a PNG file.
    // Uses CGWindowListCreateImage for proper compositor capture.
    bool CaptureWindowToFile(const std::string& output_path);

    // Capture the key window to a PNG and return it as a base64-encoded string.
    // Returns empty string on failure.
    std::string CaptureWindowToBase64();
    
private:
    struct PendingStyles {
        int startPos;
        std::string data;
    };
    std::map<std::string, ScintillaView*> views_;
    std::map<std::string, std::string> pending_content_;
    std::map<std::string, PendingStyles> pending_styles_;
    std::mutex mutex_;
};

}  // namespace extension

LYNX_EXTERN_C_BEGIN
lynx_native_view_t* scintilla_view_create_view(void* opaque);
LYNX_EXTERN_C_END

#endif // EXTENSION_SCINTILLA_VIEW_H_
