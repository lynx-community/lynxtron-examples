// Copyright 2025 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#include "module/scintilla_view.h"

#include "capi/lynx_log_capi.h"
#include <string>

#ifdef __APPLE__
#include <Cocoa/Cocoa.h>
#include "scintilla/include/Scintilla.h"
#include "scintilla/include/ScintillaTypes.h"
#include "scintilla/include/ScintillaCall.h"
#include "scintilla/cocoa/ScintillaView.h"

// Define constants if missing (Scintilla 5.x might not expose these in Scintilla.h by default or we missed a header)
#ifndef SCI_SETLEXER
#define SCI_SETLEXER 4001
#endif

#ifndef SCLEX_CONTAINER
#define SCLEX_CONTAINER 0
#endif

// Scintilla's default Cocoa content view snaps vertical scrolling to whole
// lines in -adjustScroll:. That makes small trackpad and mouse-wheel deltas
// feel sticky. Keep its horizontal whole-point alignment (which avoids Retina
// drawing debris), but allow a partially visible line vertically.
@interface LynxtronSCIContentView : SCIContentView
@end

@implementation LynxtronSCIContentView

- (NSRect)adjustScroll:(NSRect)proposedVisibleRect {
    NSRect adjustedRect = proposedVisibleRect;
    NSRect contentRect = self.bounds;
    if ((adjustedRect.origin.x > 0) &&
        (NSMaxX(adjustedRect) < contentRect.size.width)) {
        // Preserve Scintilla's horizontal whole-point snapping for positions
        // inside the document, while leaving overscroll untouched.
        adjustedRect.origin.x = std::round(adjustedRect.origin.x);
    }
    return adjustedRect;
}

@end

@interface LynxtronScintillaView : ScintillaView
- (void)syncBounceBackgroundWithStyleDefault;
@end

@implementation LynxtronScintillaView

+ (Class)contentViewClass {
    return [LynxtronSCIContentView class];
}

- (void)syncBounceBackgroundWithStyleDefault {
    // Scintilla paints the document itself, but elastic overscroll exposes
    // AppKit's scroll/clip view background. Derive that native background
    // from STYLE_DEFAULT so it stays aligned with every editor palette.
    const unsigned long bgr =
        (unsigned long)[self message:SCI_STYLEGETBACK wParam:STYLE_DEFAULT lParam:0];
    NSColor* backgroundColor = [NSColor colorWithSRGBRed:(bgr & 0xFF) / 255.0
                                                   green:((bgr >> 8) & 0xFF) / 255.0
                                                    blue:((bgr >> 16) & 0xFF) / 255.0
                                                   alpha:1.0];
    self.scrollView.drawsBackground = YES;
    self.scrollView.backgroundColor = backgroundColor;
    self.scrollView.contentView.drawsBackground = YES;
    self.scrollView.contentView.backgroundColor = backgroundColor;
}

@end

// Helper to bridge C++ and ObjC.
// Conforms to ScintillaNotificationProtocol so it receives SCN_MODIFIED and
// other Scintilla notifications directly without a separate WndProc.
@interface ScintillaViewContainer : NSView <ScintillaNotificationProtocol>
@property (nonatomic, assign) extension::ScintillaView* owner;
@property (nonatomic, strong) ScintillaView* scintillaView;
// Authoritative host-detach state, read/written ONLY on the main thread.
// The C++ atomic (detached_by_host_) is a cheap early-return hint; ordering
// correctness lives here: attach/detach/lazy-attach blocks all execute on
// the main serial queue, so a queued lazy attach that was enqueued BEFORE a
// detach still observes the detach (the old calling-thread flag check let it
// re-add the view above the overlay — and a block queued behind the
// destructor could resurrect a dead pane as a ghost subview).
@property (nonatomic, assign) BOOL hostDetached;
@end

@implementation ScintillaViewContainer

- (instancetype)initWithFrame:(NSRect)frameRect owner:(extension::ScintillaView*)owner {
    self = [super initWithFrame:frameRect];
    if (self) {
        _owner = owner;
        _scintillaView = [[LynxtronScintillaView alloc] initWithFrame:self.bounds];
        [_scintillaView setAutoresizingMask:NSViewWidthSizable | NSViewHeightSizable];
        _scintillaView.delegate = self;  // receive SCN_MODIFIED etc.
        [self addSubview:_scintillaView];
    }
    return self;
}

- (BOOL)isFlipped {
    return YES;
}

// Let Cmd+key combinations (menu accelerators like Cmd+S, Cmd+P) pass through
// to the NSMenu system instead of being consumed by the Scintilla editor.
// Without this, Scintilla's keyDown handler eats the event before the menu
// accelerator matching phase (performKeyEquivalent) has a chance to fire.
- (BOOL)performKeyEquivalent:(NSEvent *)event {
    if (event.modifierFlags & NSEventModifierFlagCommand) {
        if ([[NSApp mainMenu] performKeyEquivalent:event]) {
            return YES;
        }
    }
    return [super performKeyEquivalent:event];
}

// ScintillaNotificationProtocol — fires on the main thread for every
// Scintilla notification. We only care about content mutations and dwell events.
- (void)notification:(SCNotification*)n {
    if (!_owner) return;
    if (n->nmhdr.code == SCN_MODIFIED &&
        (n->modificationType & (SC_MOD_INSERTTEXT | SC_MOD_DELETETEXT))) {
        _owner->OnContentModified();
    } else if (n->nmhdr.code == SCN_DWELLSTART) {
        _owner->OnDwellStart(n->position, (int)n->x, (int)n->y);
    } else if (n->nmhdr.code == SCN_DWELLEND) {
        _owner->OnDwellEnd();
    }
}

@end
#endif

#ifdef __APPLE__
// Scintilla consumes Command+F in its text input path before AppKit's menu
// accelerator dispatch in some focus transitions. A single process-local
// monitor routes that exact shortcut through the application menu first.
// Returning nil prevents the same event from also reaching the editor.
static id gCommandFindMonitor = nil;

static void InstallCommandFindMonitor() {
    auto install = ^{
        if (gCommandFindMonitor) return;
        gCommandFindMonitor =
            [NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskKeyDown
                                                   handler:^NSEvent*(NSEvent* event) {
            const NSEventModifierFlags flags =
                event.modifierFlags & NSEventModifierFlagDeviceIndependentFlagsMask;
            const NSEventModifierFlags disallowed =
                NSEventModifierFlagShift |
                NSEventModifierFlagControl |
                NSEventModifierFlagOption;
            NSString* key = event.charactersIgnoringModifiers.lowercaseString;
            if ((flags & NSEventModifierFlagCommand) != 0 &&
                (flags & disallowed) == 0 &&
                [key isEqualToString:@"f"] &&
                [[NSApp mainMenu] performKeyEquivalent:event]) {
                return nil;
            }
            return event;
        }];
    };
    if ([NSThread isMainThread]) install();
    else dispatch_sync(dispatch_get_main_queue(), install);
}
#endif

namespace extension {

// Diagnostic logging is opt-in: OnLayoutChanged fires on every sash-drag
// frame, so unconditional printf turns a drag into a stdout flood. Set
// LYNXTRON_SCINTILLA_LOG=1 to trace the attach/layout lifecycle (the
// headless verification loop greps for "Adding container").
static bool ScxVerbose() {
    static const bool v = ::getenv("LYNXTRON_SCINTILLA_LOG") != nullptr;
    return v;
}
#define SCX_LOG(...) do { if (ScxVerbose()) { printf(__VA_ARGS__); fflush(stdout); } } while (0)

ScintillaView::ScintillaView() {
    SCX_LOG("ScintillaView::ScintillaView constructor called\n");
#ifdef __APPLE__
    InstallCommandFindMonitor();
    // Ensure UI operations happen on main thread
    if ([NSThread isMainThread]) {
        ScintillaViewContainer* container = [[ScintillaViewContainer alloc] initWithFrame:NSZeroRect owner:this];
        cocoa_view_ = (void*)CFBridgingRetain(container);
    } else {
        dispatch_sync(dispatch_get_main_queue(), ^{
            ScintillaViewContainer* container = [[ScintillaViewContainer alloc] initWithFrame:NSZeroRect owner:this];
            cocoa_view_ = (void*)CFBridgingRetain(container);
        });
    }
    
    // Initialize Scintilla
    if (cocoa_view_) {
        ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
        // Install the compiled defaults before the constructor returns. This
        // must not be queued asynchronously: OnPropertiesChanged may apply
        // the element's target theme on the main thread immediately after
        // construction, and a delayed default pass would overwrite it with
        // the 14pt fallback long enough to paint a visible flash.
        auto initializeScintilla = ^{
            // Set Lexer to Container (styling driven from JS)
            [container.scintillaView message:SCI_SETLEXER wParam:SCLEX_CONTAINER lParam:0];

            // --- VS Code Dark+ Theme (compiled-in DEFAULT) ---
            // This is what plain <scintilla-view> consumers get (legacy IDE).
            // Fiddle panes always carry theme-dark/font-size ATTRS which apply
            // the Fiddle Dark palette via ApplyTheme before first paint.
            // 1. Set STYLE_DEFAULT then propagate to all styles
            [container.scintillaView message:SCI_STYLESETBACK wParam:STYLE_DEFAULT lParam:0x1E1E1E]; // bg #1E1E1E
            [container.scintillaView message:SCI_STYLESETFORE wParam:STYLE_DEFAULT lParam:0xD4D4D4]; // fg #D4D4D4
            [container.scintillaView message:SCI_STYLESETSIZE wParam:STYLE_DEFAULT lParam:14];
            [container.scintillaView message:SCI_STYLECLEARALL wParam:0 lParam:0]; // propagate to all
            [(LynxtronScintillaView*)container.scintillaView syncBounceBackgroundWithStyleDefault];

            // 2. Syntax styles (Scintilla uses BGR color format)
            // Style 0: Default
            [container.scintillaView message:SCI_STYLESETFORE wParam:0 lParam:0xD4D4D4];
            // Style 1: Keyword (#569CD6 → BGR 0xD69C56)
            [container.scintillaView message:SCI_STYLESETFORE wParam:1 lParam:0xD69C56];
            [container.scintillaView message:SCI_STYLESETBOLD wParam:1 lParam:1];
            // Style 2: String (#CE9178 → BGR 0x7891CE)
            [container.scintillaView message:SCI_STYLESETFORE wParam:2 lParam:0x7891CE];
            // Style 3: Comment (#6A9955 → BGR 0x55996A)
            [container.scintillaView message:SCI_STYLESETFORE wParam:3 lParam:0x55996A];
            // Style 4: Number (#B5CEA8 → BGR 0xA8CEB5)
            [container.scintillaView message:SCI_STYLESETFORE wParam:4 lParam:0xA8CEB5];
            // Style 5: Type (#4EC9B0 → BGR 0xB0C94E)
            [container.scintillaView message:SCI_STYLESETFORE wParam:5 lParam:0xB0C94E];

            // 3. Line number margin
            [container.scintillaView message:SCI_SETMARGINTYPEN wParam:0 lParam:SC_MARGIN_NUMBER];
            [container.scintillaView message:SCI_SETMARGINWIDTHN wParam:0 lParam:50];
            [container.scintillaView message:SCI_STYLESETFORE wParam:STYLE_LINENUMBER lParam:0x858585];
            [container.scintillaView message:SCI_STYLESETBACK wParam:STYLE_LINENUMBER lParam:0x1E1E1E];

            // 4. Editor settings
            [container.scintillaView message:SCI_SETCARETFORE wParam:0xADAFAE lParam:0];
            [container.scintillaView message:SCI_SETSELBACK wParam:1 lParam:0xBB6A26]; // selection #266ABB → BGR (brighter blue)
            [container.scintillaView message:SCI_SETTABWIDTH wParam:4 lParam:0];
            [container.scintillaView message:SCI_SETSCROLLWIDTHTRACKING wParam:1 lParam:0];
            [container.scintillaView message:SCI_SETSCROLLWIDTH wParam:2000 lParam:0];

            // 5. Mouse dwell time for hover tooltip (600 ms stationary)
            [container.scintillaView message:SCI_SETMOUSEDWELLTIME wParam:600 lParam:0];

            // 6. Calltip (hover tooltip) styling — dark theme
            // Background #252526 → BGR 0x262525, Foreground #D4D4D4 → BGR 0xD4D4D4
            [container.scintillaView message:SCI_CALLTIPSETBACK wParam:0x262525 lParam:0];
            [container.scintillaView message:SCI_CALLTIPSETFORE  wParam:0xD4D4D4 lParam:0];

            // 6. Diagnostic indicators (squiggle underlines)
            //    Indicator 0: error  — red    (#FA3232 → BGR 0x3232FA)
            //    Indicator 1: warning — yellow (#FFBB00 → BGR 0x00BBFF)
            //    Indicator 2: info   — blue   (#0088FF → BGR 0xFF8800)
            for (int ind = 0; ind < 3; ind++) {
                [container.scintillaView message:SCI_INDICSETSTYLE wParam:ind lParam:INDIC_SQUIGGLE];
                [container.scintillaView message:SCI_INDICSETUNDER wParam:ind lParam:1]; // draw under text
            }
            [container.scintillaView message:SCI_INDICSETFORE wParam:0 lParam:0x3232FA];
            [container.scintillaView message:SCI_INDICSETFORE wParam:1 lParam:0x00BBFF];
            [container.scintillaView message:SCI_INDICSETFORE wParam:2 lParam:0xFF8800];
        };
        if ([NSThread isMainThread]) {
            initializeScintilla();
        } else {
            dispatch_sync(dispatch_get_main_queue(), initializeScintilla);
        }
    }
#endif
}

ScintillaView::~ScintillaView() {
    SCX_LOG("ScintillaView::~ScintillaView destructor called\n");
    if (!editor_id_.empty()) {
        ScintillaRegistry::Get().Unregister(editor_id_, this);
    }
#ifdef __APPLE__
    if (cocoa_view_) {
        DetachFromWindow();
        void* view_to_release = cocoa_view_;
        ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)view_to_release;
        cocoa_view_ = nullptr;

        if ([NSThread isMainThread]) {
            container.owner = nullptr;
            CFBridgingRelease(view_to_release);
        } else {
            dispatch_async(dispatch_get_main_queue(), ^{
                container.owner = nullptr;
                CFBridgingRelease(view_to_release);
            });
        }
    }
#endif
}

void ScintillaView::OnPropertiesChanged(const lynx::pub::LynxValue& attrs,
                                   const lynx::pub::LynxValue& events) {
    if (attrs.HasProperty("editor-id")) {
        std::string new_id = attrs.GetProperty("editor-id").StdString();
        SCX_LOG("ScintillaView::OnPropertiesChanged editor-id: %s\n", new_id.c_str());
        if (new_id != editor_id_) {
            if (!editor_id_.empty()) ScintillaRegistry::Get().Unregister(editor_id_, this);
            editor_id_ = new_id;
            ScintillaRegistry::Get().Register(editor_id_, this);
        }
    }

    // Host suppression state (dialog/overlay open) must land before the
    // first layout pass — panes created UNDER an open dialog (mosaic rebuild
    // while Settings is up) would otherwise lazily attach above it.
    if (attrs.HasProperty("suppressed")) {
        std::string v = attrs.GetProperty("suppressed").StdString();
        bool sup = !(v == "false" || v == "0");
        if (sup) {
            DetachFromWindow(); // sets detached_by_host_, idempotent
        } else if (detached_by_host_.load(std::memory_order_relaxed)) {
            // The attribute is a COMPLETE channel: un-suppress reattaches and
            // restores the last frame natively. (Clearing only the flag left
            // reattach to a JS-side timer, because OnLayoutChanged never
            // fires when an absolutely-positioned overlay closes.)
            AttachToWindow();
        }
    }

    // Theme attributes land before the first paint — applying here (instead
    // of a post-mount JS call) kills the one-frame flash of the compiled-in
    // defaults (14pt dark) before the configured size/theme arrives.
    {
        bool dark = theme_dark_;
        int size = font_size_pt_;
        bool themed = false;
        if (attrs.HasProperty("theme-dark")) {
            std::string v = attrs.GetProperty("theme-dark").StdString();
            dark = !(v == "false" || v == "0");
            themed = true;
        }
        if (attrs.HasProperty("font-size")) {
            std::string v = attrs.GetProperty("font-size").StdString();
            int n = atoi(v.c_str());
            if (n >= 6 && n <= 64) { size = n; themed = true; }
        }
        if (themed) ApplyTheme(dark, size);
    }

    // Handle properties like content, language, theme, etc.
#ifdef __APPLE__
    if (attrs.HasProperty("content")) {
        // SetContent logic duplicates what we have in SetContent method
        // But for direct props update:
        std::string content = attrs.GetProperty("content").StdString();
        SetContent(content.data(), content.size());
    }
#endif
}

void ScintillaView::OnLayoutChanged(float left, float top, float width, float height,
                               float pixel_ratio) {
    SCX_LOG("ScintillaView::OnLayoutChanged: left=%f, top=%f, width=%f, height=%f\n", left, top, width, height);
    RecordLayoutRect(left, top, width, height);
#ifdef __APPLE__
    // While the host detached us (dialog/overlay/drag), do NOT lazily attach —
    // a native view added now would float above the overlay. The frame is
    // recorded above; AttachToWindow restores it. This flag check is a cheap
    // hint on the calling thread; the authoritative (race-free) check is
    // container.hostDetached inside the main-thread block below.
    if (detached_by_host_.load(std::memory_order_relaxed)) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    // So we just need to ensure the container resizes its subviews (ScintillaView).
    auto attachToWindow = [container]() {
        if (container.hostDetached) return; // detach won the race — stay out
        if (container.superview != nil) return;
        // Prefer keyWindow, fall back to mainWindow, then first available
        // window. KNOWN LIMITATION: with several windows in one process this
        // can attach to whichever window happens to be key — the fallback
        // chain is a heuristic, not multi-window support (gap 2b).
        NSWindow* window = [NSApp keyWindow];
        if (!window) window = [NSApp mainWindow];
        if (!window) window = [[NSApp windows] firstObject];
        if (window) {
            SCX_LOG("ScintillaView::OnLayoutChanged: Adding container to window contentView\n");
            [window.contentView addSubview:container];
        } else {
            SCX_LOG("ScintillaView::OnLayoutChanged: Warning - No window found to add subview\n");
        }
    };

    // Lynx layout uses top-left origin (y increases downward), but macOS
    // NSView contentView uses bottom-left origin (y increases upward) by
    // default. We need to flip y: nsY = contentViewHeight - top - height.
    auto setFrameInWindow = [container, left, top, width, height]() {
        NSView* parent = container.superview;
        if (!parent) return;
        CGFloat parentH = parent.bounds.size.height;
        CGFloat flippedY = parentH - top - height;
        NSRect frame = NSMakeRect(left, flippedY, width, height);
        [container setFrame:frame];
    };

    if ([NSThread isMainThread]) {
        attachToWindow();
        setFrameInWindow();
    } else {
        dispatch_async(dispatch_get_main_queue(), ^{
            attachToWindow();
            setFrameInWindow();
        });
    }
#endif
}

void ScintillaView::OnMotionEvent(native_view_motion_event_t* event) {
    // Mouse events are handled by the NSView directly since it's a real view now (not a surface)
}

void ScintillaView::SetContent(const char* data, size_t length) {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;

    // Ensure null termination if using C-string API
    std::string text(data, length);

    auto doSet = ^{
        // IDEMPOTENT: SCI_SETTEXT wipes every style byte and resets
        // scroll/caret. The host re-pushes content liberally (dialog-close
        // reattach, pane first-layout nudge, showEditor) and relies on a
        // later async setStyles to restore the highlight — when that raced,
        // the highlight "randomly" came up blank. Identical content must be
        // a strict no-op so nothing ever clears the style bytes.
        sptr_t doc_len = [container.scintillaView message:SCI_GETTEXTLENGTH wParam:0 lParam:0];
        if ((size_t)doc_len == text.size()) {
            std::string current((size_t)doc_len + 1, '\0');
            [container.scintillaView message:SCI_GETTEXT wParam:doc_len + 1 lParam:(sptr_t)current.data()];
            current.resize((size_t)doc_len);
            if (current == text) return;
        }
        [container.scintillaView message:SCI_SETTEXT wParam:0 lParam:(sptr_t)text.c_str()];
        [container.scintillaView setNeedsDisplay:YES];
    };
    if ([NSThread isMainThread]) {
        doSet();
    } else {
        // Dispatch to main thread for UI access; 'text' is copied into the block.
        dispatch_async(dispatch_get_main_queue(), doSet);
    }
#endif
}

std::string ScintillaView::GetContent() {
#ifdef __APPLE__
    if (!cocoa_view_) return "";
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;

    __block std::string text;
    auto doGet = ^{
        sptr_t length = [container.scintillaView message:SCI_GETTEXTLENGTH wParam:0 lParam:0];
        text.resize(length + 1, '\0');
        [container.scintillaView message:SCI_GETTEXT wParam:length + 1 lParam:(sptr_t)text.data()];
        text.resize(length);
    };

    if ([NSThread isMainThread]) {
        doGet();
    } else {
        dispatch_sync(dispatch_get_main_queue(), doGet);
    }
    return text;
#else
    return "";
#endif
}

void ScintillaView::ApplyStyles(int startPos, const char* styles, size_t length) {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    
    // We need to copy styling data because it will be used in the block on main thread
    std::string styleData(styles, length);
    
    auto doStyle = ^{
        // Styles are computed from a JS-side snapshot that can lag the live
        // document by a poll tick — clamp so a stale buffer can't style past
        // the end of the document (the debounced re-highlight converges).
        sptr_t doc_len = [container.scintillaView message:SCI_GETTEXTLENGTH wParam:0 lParam:0];
        if (startPos >= doc_len) return;
        size_t apply_len = styleData.size();
        if ((sptr_t)(startPos + apply_len) > doc_len) apply_len = (size_t)(doc_len - startPos);
        [container.scintillaView message:SCI_STARTSTYLING wParam:startPos lParam:0];
        [container.scintillaView message:SCI_SETSTYLINGEX wParam:apply_len lParam:(sptr_t)styleData.c_str()];
        // SCI_SETSTYLINGEX fires SC_MOD_CHANGESTYLERANGE which triggers Scintilla's own
        // redraw scheduling. Avoid calling setNeedsDisplay:YES here — it causes an extra
        // full-view repaint that produces visible line-scan flashing while typing.
    };
    if ([NSThread isMainThread]) {
        doStyle();
    } else {
        dispatch_async(dispatch_get_main_queue(), doStyle);
    }
#endif
}

void ScintillaView::UpdateLayoutPosition(float left, float top) {
    std::lock_guard<std::mutex> lock(dwell_mutex_);
    layout_left_ = left;
    layout_top_ = top;
}

void ScintillaView::RecordLayoutRect(float left, float top, float width, float height) {
    std::lock_guard<std::mutex> lock(dwell_mutex_);
    layout_left_ = left;
    layout_top_ = top;
    last_layout_w_ = width;
    last_layout_h_ = height;
}

void ScintillaView::OnDwellStart(int bytePos, int x, int y) {
    std::lock_guard<std::mutex> lock(dwell_mutex_);
    // Convert view-local dwell coordinates to Lynx layout coordinates.
    dwell_info_ = { true, bytePos, layout_left_ + (float)x, layout_top_ + (float)y };
}

void ScintillaView::OnDwellEnd() {
    std::lock_guard<std::mutex> lock(dwell_mutex_);
    dwell_info_ = { false, -1, 0.0f, 0.0f };
}

ScintillaView::DwellInfo ScintillaView::GetDwellInfo() const {
    std::lock_guard<std::mutex> lock(dwell_mutex_);
    return dwell_info_;
}

bool ScintillaView::ShowCalltip(int bytePos, const std::string& text) {
#ifdef __APPLE__
    if (!cocoa_view_) return false;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    std::string textCopy = text;
    __block bool active = false;
    auto doShow = ^{
        [container.scintillaView message:SCI_CALLTIPSHOW wParam:bytePos lParam:(sptr_t)textCopy.c_str()];
        active = [container.scintillaView message:SCI_CALLTIPACTIVE wParam:0 lParam:0] != 0;
    };
    if ([NSThread isMainThread]) doShow();
    else dispatch_sync(dispatch_get_main_queue(), doShow);
    return active;
#else
    return false;
#endif
}

void ScintillaView::HideCalltip() {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    auto doHide = ^{
        [container.scintillaView message:SCI_CALLTIPCANCEL wParam:0 lParam:0];
    };
    if ([NSThread isMainThread]) doHide();
    else dispatch_sync(dispatch_get_main_queue(), doHide);
#endif
}

void ScintillaView::GotoLine(int line) {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    auto doGoto = ^{
        [container.scintillaView message:SCI_GOTOLINE wParam:line lParam:0];
    };
    if ([NSThread isMainThread]) doGoto();
    else dispatch_async(dispatch_get_main_queue(), doGoto);
#endif
}

void ScintillaView::SetSelection(int anchor, int caret) {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    auto doSel = ^{
        [container.scintillaView message:SCI_SETSEL wParam:anchor lParam:caret];
    };
    if ([NSThread isMainThread]) doSel();
    else dispatch_async(dispatch_get_main_queue(), doSel);
#endif
}

void ScintillaView::FocusEditor() {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    auto doFocus = ^{
        NSWindow* window = container.window;
        if (!window) return; // detached — nothing to focus
        [window makeFirstResponder:container.scintillaView];
        [container.scintillaView message:SCI_SETFOCUS wParam:1 lParam:0];
    };
    if ([NSThread isMainThread]) doFocus();
    else dispatch_async(dispatch_get_main_queue(), doFocus);
#endif
}

bool ScintillaView::HasFocus() {
#ifdef __APPLE__
    if (!cocoa_view_) return false;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    __block bool focused = false;
    auto checkFocus = ^{
        // SCI_GETFOCUS can remain stale while focus moves between sibling
        // native editors and a Lynx <input>. The AppKit first responder is
        // authoritative for deciding which pane owns the next Cmd+F.
        NSResponder* responder = container.window.firstResponder;
        if ([responder isKindOfClass:[NSView class]]) {
            NSView* responderView = (NSView*)responder;
            focused =
                responderView == container ||
                [responderView isDescendantOf:container];
        }
    };
    if ([NSThread isMainThread]) checkFocus();
    else dispatch_sync(dispatch_get_main_queue(), checkFocus);
    return focused;
#else
    return false;
#endif
}

void ScintillaView::ScrollCaret() {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    auto doScroll = ^{
        [container.scintillaView message:SCI_SCROLLCARET wParam:0 lParam:0];
    };
    if ([NSThread isMainThread]) doScroll();
    else dispatch_async(dispatch_get_main_queue(), doScroll);
#endif
}

void ScintillaView::DetachFromWindow() {
    detached_by_host_.store(true, std::memory_order_relaxed);
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    auto doDetach = ^{
        container.hostDetached = YES; // main-thread authority — see property doc
        [container.scintillaView message:SCI_CALLTIPCANCEL wParam:0 lParam:0];
        [container removeFromSuperview];
    };
    if ([NSThread isMainThread]) {
        doDetach();
    } else {
        dispatch_sync(dispatch_get_main_queue(), doDetach);
    }
#endif
}

void ScintillaView::AttachToWindow() {
    detached_by_host_.store(false, std::memory_order_relaxed);
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    float left, top, w, h;
    {
        std::lock_guard<std::mutex> lock(dwell_mutex_);
        left = layout_left_; top = layout_top_;
        w = last_layout_w_; h = last_layout_h_;
    }
    auto doAttach = ^{
        container.hostDetached = NO;
        if (container.superview == nil) {
            NSWindow* window = [NSApp keyWindow];
            if (!window) window = [NSApp mainWindow];
            if (!window) window = [[NSApp windows] firstObject];
            if (window) {
                [window.contentView addSubview:container];
            } else {
                SCX_LOG("ScintillaView::AttachToWindow: Warning - No window found to add subview\n");
                return;
            }
        }
        // Restore the LAST layout rect — the layout may have changed while we
        // were detached (sash drags relayout constantly) and those
        // OnLayoutChanged passes intentionally skipped attach/setFrame.
        if (w > 0 && h > 0 && container.superview != nil) {
            NSView* parent = container.superview;
            CGFloat parentH = parent.bounds.size.height;
            CGFloat flippedY = parentH - top - h;
            [container setFrame:NSMakeRect(left, flippedY, w, h)];
        }
    };
    if ([NSThread isMainThread]) {
        doAttach();
    } else {
        dispatch_sync(dispatch_get_main_queue(), doAttach);
    }
#endif
}

void ScintillaView::ApplyTheme(bool dark, int size_pt) {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    // BGR palettes. Dark = the compile-time Fiddle Dark constants; Light =
    // VS-Light token colors on Fiddle Light backgrounds.
    const long bg      = dark ? 0x41322F : 0xFEFFFF;
    const long fg      = dark ? 0xD4D4D4 : 0x000000;
    const long kw      = dark ? 0xD69C56 : 0xFF0000;
    const long str     = dark ? 0x7891CE : 0x1515A3;
    const long cmt     = dark ? 0x55996A : 0x008000;
    const long num     = dark ? 0xA8CEB5 : 0x588609;
    const long typ     = dark ? 0xB0C94E : 0x997F26;
    const long lnFore  = dark ? 0x858585 : 0x937823;
    const long lnBack  = dark ? 0x41322F : 0xF5F5F5;
    const long caret   = dark ? 0xADAFAE : 0x000000;
    const long selBack = dark ? 0xBB6A26 : 0xFFD6AD;
    const long ctBack  = dark ? 0x262525 : 0xF3F3F3;
    const long ctFore  = dark ? 0xD4D4D4 : 0x000000;
    const int  size    = size_pt > 0 ? size_pt : 14;
    theme_dark_ = dark;
    font_size_pt_ = size;
    auto doApply = ^{
        [container.scintillaView message:SCI_STYLESETBACK wParam:STYLE_DEFAULT lParam:bg];
        [container.scintillaView message:SCI_STYLESETFORE wParam:STYLE_DEFAULT lParam:fg];
        [container.scintillaView message:SCI_STYLESETSIZE wParam:STYLE_DEFAULT lParam:size];
        [container.scintillaView message:SCI_STYLECLEARALL wParam:0 lParam:0];
        [(LynxtronScintillaView*)container.scintillaView syncBounceBackgroundWithStyleDefault];
        [container.scintillaView message:SCI_STYLESETFORE wParam:0 lParam:fg];
        [container.scintillaView message:SCI_STYLESETFORE wParam:1 lParam:kw];
        [container.scintillaView message:SCI_STYLESETBOLD wParam:1 lParam:1];
        [container.scintillaView message:SCI_STYLESETFORE wParam:2 lParam:str];
        [container.scintillaView message:SCI_STYLESETFORE wParam:3 lParam:cmt];
        [container.scintillaView message:SCI_STYLESETFORE wParam:4 lParam:num];
        [container.scintillaView message:SCI_STYLESETFORE wParam:5 lParam:typ];
        [container.scintillaView message:SCI_STYLESETFORE wParam:STYLE_LINENUMBER lParam:lnFore];
        [container.scintillaView message:SCI_STYLESETBACK wParam:STYLE_LINENUMBER lParam:lnBack];
        [container.scintillaView message:SCI_SETCARETFORE wParam:caret lParam:0];
        [container.scintillaView message:SCI_SETSELBACK wParam:1 lParam:selBack];
        [container.scintillaView message:SCI_CALLTIPSETBACK wParam:ctBack lParam:0];
        [container.scintillaView message:SCI_CALLTIPSETFORE wParam:ctFore lParam:0];
    };
    // Theme properties are part of native element construction. Finish the
    // main-thread update before returning so layout cannot attach and paint
    // an intermediate background/font size.
    if ([NSThread isMainThread]) doApply();
    else dispatch_sync(dispatch_get_main_queue(), doApply);
#endif
}

void ScintillaView::ClearIndicators() {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    auto doClear = ^{
        sptr_t docLen = [container.scintillaView message:SCI_GETTEXTLENGTH wParam:0 lParam:0];
        for (int ind = 0; ind < 3; ind++) {
            [container.scintillaView message:SCI_SETINDICATORCURRENT wParam:ind lParam:0];
            [container.scintillaView message:SCI_INDICATORCLEARRANGE wParam:0 lParam:docLen];
        }
    };
    if ([NSThread isMainThread]) doClear();
    else dispatch_async(dispatch_get_main_queue(), doClear);
#endif
}

void ScintillaView::SetIndicators(const std::vector<std::tuple<int,int,int>>& ranges) {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    // Copy ranges into the block to avoid dangling reference.
    std::vector<std::tuple<int,int,int>> rangesCopy = ranges;
    auto doSet = ^{
        // Clear all indicators first.
        sptr_t docLen = [container.scintillaView message:SCI_GETTEXTLENGTH wParam:0 lParam:0];
        for (int ind = 0; ind < 3; ind++) {
            [container.scintillaView message:SCI_SETINDICATORCURRENT wParam:ind lParam:0];
            [container.scintillaView message:SCI_INDICATORCLEARRANGE wParam:0 lParam:docLen];
        }
        // Fill new ranges.
        for (const auto& [start, length, style] : rangesCopy) {
            if (style < 0 || style > 2 || length <= 0 || start < 0) continue;
            [container.scintillaView message:SCI_SETINDICATORCURRENT wParam:style lParam:0];
            [container.scintillaView message:SCI_INDICATORFILLRANGE wParam:start lParam:length];
        }
    };
    if ([NSThread isMainThread]) doSet();
    else dispatch_async(dispatch_get_main_queue(), doSet);
#endif
}

// Capture the composited key window to a PNG file using the 'screencapture' CLI tool.
// This is the reliable way on macOS 15+ (CGWindowListCreateImage was removed).
// screencapture -l WINDOW_ID captures the window server's compositor output, which
// includes all native NSViews (like Scintilla) that the Lynx Skia canvas does not know about.
// Returns the PNG data, or nil on failure.
static NSData* CaptureKeyWindowToPNG() {
    NSWindow* window = [NSApp keyWindow];
    if (!window) return nil;

    NSString* tmpPath = @"/tmp/lynxtron_window_capture_tmp.png";
    // Remove stale temp file
    [[NSFileManager defaultManager] removeItemAtPath:tmpPath error:nil];

    NSString* windowIDStr = [NSString stringWithFormat:@"%ld", (long)[window windowNumber]];
    NSTask* task = [[NSTask alloc] init];
    [task setLaunchPath:@"/usr/sbin/screencapture"];
    // -x: no sound  -l WINID: specific window  -t png: format
    [task setArguments:@[@"-x", @"-l", windowIDStr, @"-t", @"png", tmpPath]];

    NSError* launchError = nil;
    if (![task launchAndReturnError:&launchError]) {
        NSLog(@"[ScintillaExt] screencapture launch failed: %@", launchError);
        return nil;
    }
    [task waitUntilExit];

    if ([task terminationStatus] != 0) {
        NSLog(@"[ScintillaExt] screencapture exited with status %d", [task terminationStatus]);
        return nil;
    }

    return [NSData dataWithContentsOfFile:tmpPath];
}

bool ScintillaRegistry::CaptureWindowToFile(const std::string& output_path) {
#ifdef __APPLE__
    __block bool success = false;
    dispatch_sync(dispatch_get_main_queue(), ^{
        NSData* data = CaptureKeyWindowToPNG();
        if (!data) return;
        NSString* pathNS = [NSString stringWithUTF8String:output_path.c_str()];
        success = [data writeToFile:pathNS atomically:YES];
    });
    return success;
#else
    return false;
#endif
}

std::string ScintillaRegistry::CaptureWindowToBase64() {
#ifdef __APPLE__
    __block std::string result;
    dispatch_sync(dispatch_get_main_queue(), ^{
        NSData* data = CaptureKeyWindowToPNG();
        if (!data) return;
        NSString* b64 = [data base64EncodedStringWithOptions:0];
        if (b64) result = std::string([b64 UTF8String]);
    });
    return result;
#else
    return "";
#endif
}

}  // namespace extension

LYNX_EXTERN_C lynx_native_view_t* scintilla_view_create_view(void* opaque) {
  auto* view = new extension::ScintillaView();
  
  auto* native_wrapper = view->native_view(); 
  
  // Removed hacky struct access. We now manually mount the view in OnLayoutChanged.
  // This avoids dependency on internal struct layout of lynx_native_view_t.

  return native_wrapper;
}
