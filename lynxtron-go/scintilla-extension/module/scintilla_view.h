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
#include <set>
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
  // Record the full layout rect under the same lock — AttachToWindow reads
  // these fields from another thread to restore the frame.
  void RecordLayoutRect(float left, float top, float width, float height);
  void OnDwellStart(int bytePos, int x, int y);
  void OnDwellEnd();
  DwellInfo GetDwellInfo() const;

  // Calltip (native Scintilla hover popup).
  bool ShowCalltip(int bytePos, const std::string& text);
  void HideCalltip();

  // Navigation: go to line (0-based), set selection (byte positions), scroll caret visible
  void GotoLine(int line);
  void SetSelection(int anchor, int caret);
  void ScrollCaret();
  // Give the editor keyboard focus (sidebar file select → focus that pane).
  void FocusEditor();
  void RepositionForParentMove();
  void HideForParentTransition();
  bool ShouldStayHiddenForParentTransition() const;

  // Detach the Cocoa editor view from the host window while preserving the
  // editor instance for a later layout pass to reattach it. Idempotent and
  // safe on never-attached views (the pending-detach path in Register uses
  // it directly).
  void DetachFromWindow();

  // Re-attach a previously detached editor view (inverse of DetachFromWindow).
  // Needed explicitly: layout passes don't fire when an absolutely-positioned
  // overlay closes, so OnLayoutChanged's lazy attach never runs.
  void AttachToWindow();

  // Re-apply the full editor theme (base colors, token palette, gutter,
  // caret/selection/calltip) + font size at runtime. dark=false selects the
  // VS-Light-style palette on Fiddle Light backgrounds.
  void ApplyTheme(bool dark, int size_pt);

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
  // Host-driven detach (dialogs/overlays/drags): while set, OnLayoutChanged's
  // lazy attach must NOT re-add the view — it would float above the overlay.
  std::atomic<bool> detached_by_host_{false};
  // Last layout rect (pt) so AttachToWindow can restore the frame even when
  // layout changed while detached. Guarded by dwell_mutex_ (written on the
  // layout thread, read from AttachToWindow callers).
  float last_layout_w_ = 0.0f;
  float last_layout_h_ = 0.0f;
  bool theme_dark_ = true;
  int font_size_pt_ = 14;
  mutable std::mutex dwell_mutex_;
  DwellInfo dwell_info_{false, -1, 0.0f, 0.0f};
  float layout_left_ = 0.0f;
  float layout_top_ = 0.0f;
};

// Global Registry for N-API access.
//
// LOCKING RULE: mutex_ protects the maps ONLY. View methods are always
// invoked OUTSIDE the lock — most of them hop onto the platform UI thread
// (dispatch_sync / SendMessageW), and calling them while holding mutex_
// deadlocks against any UI-thread path that enters the registry (e.g.
// OnPropertiesChanged → Register). LIFETIME CAVEAT: a pointer copied out of
// the map can race ~ScintillaView on the element-teardown thread; the window
// is tiny (methods immediately dispatch blocks that retain the platform
// view, not `this`) but a full fix needs the Lynx-owned-child-view hosting
// rework tracked as gap 2b.
class ScintillaRegistry {
public:
    static ScintillaRegistry& Get() {
        static ScintillaRegistry instance;
        return instance;
    }

    void Register(const std::string& id, ScintillaView* view) {
        std::string content; bool has_content = false;
        PendingStyles styles{0, {}}; bool has_styles = false;
        bool host_detached = false;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            views_[id] = view;
            auto cit = pending_content_.find(id);
            if (cit != pending_content_.end()) {
                content = std::move(cit->second); has_content = true;
                pending_content_.erase(cit);
            }
            auto sit = pending_styles_.find(id);
            if (sit != pending_styles_.end()) {
                styles = std::move(sit->second); has_styles = true;
                pending_styles_.erase(sit);
            }
            host_detached = pending_host_detach_.erase(id) > 0;
        }
        // Apply pending content first, then pending styles (order matters).
        if (has_content) view->SetContent(content.data(), content.size());
        if (has_styles) view->ApplyStyles(styles.startPos, styles.data.data(), styles.data.size());
        // Full detach, not just a flag: an already-attached view re-registered
        // under this id (editor-id change) must actually leave the window.
        if (host_detached) view->DetachFromWindow();
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
        ScintillaView* view = nullptr;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = views_.find(id);
            if (it == views_.end()) {
                pending_content_[id] = std::string(data, length);
                EvictPendingIfNeededLocked();
                return true;
            }
            view = it->second;
        }
        view->SetContent(data, length);
        return true;
    }

    // Apply styles to a view (or queue as pending if view not yet registered)
    bool ApplyStyles(const std::string& id, int startPos, const char* styles, size_t length) {
        ScintillaView* view = nullptr;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = views_.find(id);
            if (it == views_.end()) {
                pending_styles_[id] = { startPos, std::string(styles, length) };
                EvictPendingIfNeededLocked();
                return true;
            }
            view = it->second;
        }
        view->ApplyStyles(startPos, styles, length);
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
        ScintillaView* view = Find(id);
        if (!view) return false;
        return view->ShowCalltip(bytePos, text);
    }

    bool HideCalltip(const std::string& id) {
        ScintillaView* view = Find(id);
        if (!view) return false;
        view->HideCalltip();
        return true;
    }

    bool SetIndicators(const std::string& id,
                       const std::vector<std::tuple<int,int,int>>& ranges) {
        ScintillaView* view = Find(id);
        if (!view) return false;
        view->SetIndicators(ranges);
        return true;
    }

    bool ClearIndicators(const std::string& id) {
        ScintillaView* view = Find(id);
        if (!view) return false;
        view->ClearIndicators();
        return true;
    }

    bool GotoLine(const std::string& id, int line) {
        ScintillaView* view = Find(id);
        if (!view) return false;
        view->GotoLine(line);
        return true;
    }

    bool SetSelection(const std::string& id, int anchor, int caret) {
        ScintillaView* view = Find(id);
        if (!view) return false;
        view->SetSelection(anchor, caret);
        return true;
    }

    bool ScrollCaret(const std::string& id) {
        ScintillaView* view = Find(id);
        if (!view) return false;
        view->ScrollCaret();
        return true;
    }

    bool Focus(const std::string& id) {
        ScintillaView* view = Find(id);
        if (!view) return false;
        view->FocusEditor();
        return true;
    }

    bool DetachFromWindow(const std::string& id) {
        ScintillaView* view = nullptr;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = views_.find(id);
            if (it == views_.end()) {
                // Not registered yet — remember the request (symmetric with
                // pending_content_). Without this, a detach issued while the
                // pane was still initializing was a silent no-op and the view
                // lazily attached ABOVE the overlay moments later.
                pending_host_detach_.insert(id);
                return true;
            }
            pending_host_detach_.erase(id);
            view = it->second;
        }
        view->DetachFromWindow();
        return true;
    }

    bool AttachToWindow(const std::string& id) {
        ScintillaView* view = nullptr;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            // Erasing the pending detach IS the attach for a not-yet-
            // registered view: with no pending flag it lazily attaches on
            // its first layout pass.
            pending_host_detach_.erase(id);
            auto it = views_.find(id);
            if (it == views_.end()) return false;
            view = it->second;
        }
        view->AttachToWindow();
        return true;
    }

    bool ApplyTheme(const std::string& id, bool dark, int size_pt) {
        ScintillaView* view = Find(id);
        if (!view) return false;
        view->ApplyTheme(dark, size_pt);
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

    ScintillaView* Find(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = views_.find(id);
        return it == views_.end() ? nullptr : it->second;
    }

    // Pending buffers hold FULL file contents for ids that may never
    // register (pane closed mid-init, renamed files) — bound them so a long
    // session can't accumulate megabytes of orphaned text. Eviction order is
    // arbitrary (map order); at this cap it only ever hits pathological ids.
    static constexpr size_t kMaxPendingEntries = 64;
    void EvictPendingIfNeededLocked() {
        while (pending_content_.size() > kMaxPendingEntries) {
            pending_content_.erase(pending_content_.begin());
        }
        while (pending_styles_.size() > kMaxPendingEntries) {
            pending_styles_.erase(pending_styles_.begin());
        }
    }

    std::map<std::string, ScintillaView*> views_;
    std::map<std::string, std::string> pending_content_;
    std::map<std::string, PendingStyles> pending_styles_;
    std::set<std::string> pending_host_detach_;
    std::mutex mutex_;
};

}  // namespace extension

LYNX_EXTERN_C_BEGIN
lynx_native_view_t* scintilla_view_create_view(void* opaque);
LYNX_EXTERN_C_END

#endif // EXTENSION_SCINTILLA_VIEW_H_
