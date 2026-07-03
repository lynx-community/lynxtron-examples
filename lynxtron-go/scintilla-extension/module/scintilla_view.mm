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

// Helper to bridge C++ and ObjC.
// Conforms to ScintillaNotificationProtocol so it receives SCN_MODIFIED and
// other Scintilla notifications directly without a separate WndProc.
@interface ScintillaViewContainer : NSView <ScintillaNotificationProtocol>
@property (nonatomic, assign) extension::ScintillaView* owner;
@property (nonatomic, strong) ScintillaView* scintillaView;
@end

@implementation ScintillaViewContainer

- (instancetype)initWithFrame:(NSRect)frameRect owner:(extension::ScintillaView*)owner {
    NSLog(@"ScintillaViewContainer initWithFrame: %@", NSStringFromRect(frameRect));
    self = [super initWithFrame:frameRect];
    if (self) {
        _owner = owner;
        _scintillaView = [[ScintillaView alloc] initWithFrame:self.bounds];
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

namespace extension {

ScintillaView::ScintillaView() {
    printf("ScintillaView::ScintillaView constructor called\n");
#ifdef __APPLE__
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
        // Dispatch config to main thread if needed, but since we are in constructor and just created it,
        // we might be on any thread. Safest to dispatch.
        // Actually the container creation above ensures we have the view.
        
        dispatch_async(dispatch_get_main_queue(), ^{
            // Set Lexer to Container (styling driven from JS)
            [container.scintillaView message:SCI_SETLEXER wParam:SCLEX_CONTAINER lParam:0];

            // --- VS Code Dark+ Theme ---
            // 1. Set STYLE_DEFAULT then propagate to all styles
            [container.scintillaView message:SCI_STYLESETBACK wParam:STYLE_DEFAULT lParam:0x1E1E1E]; // bg #1E1E1E
            [container.scintillaView message:SCI_STYLESETFORE wParam:STYLE_DEFAULT lParam:0xD4D4D4]; // fg #D4D4D4
            [container.scintillaView message:SCI_STYLESETSIZE wParam:STYLE_DEFAULT lParam:14];
            [container.scintillaView message:SCI_STYLECLEARALL wParam:0 lParam:0]; // propagate to all

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
        });
    }
#endif
}

ScintillaView::~ScintillaView() {
    printf("ScintillaView::~ScintillaView destructor called\n");
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
        printf("ScintillaView::OnPropertiesChanged editor-id: %s\n", new_id.c_str());
        if (new_id != editor_id_) {
            if (!editor_id_.empty()) ScintillaRegistry::Get().Unregister(editor_id_, this);
            editor_id_ = new_id;
            ScintillaRegistry::Get().Register(editor_id_, this);
        }
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
    printf("ScintillaView::OnLayoutChanged: left=%f, top=%f, width=%f, height=%f\n", left, top, width, height);
    UpdateLayoutPosition(left, top);
#ifdef __APPLE__
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    // So we just need to ensure the container resizes its subviews (ScintillaView).
    auto attachToWindow = [container]() {
        if (container.superview != nil) return;
        // Prefer keyWindow, fall back to mainWindow, then first available window.
        NSWindow* window = [NSApp keyWindow];
        if (!window) window = [NSApp mainWindow];
        if (!window) window = [[NSApp windows] firstObject];
        if (window) {
            printf("ScintillaView::OnLayoutChanged: Adding container to window contentView\n");
            [window.contentView addSubview:container];
        } else {
            printf("ScintillaView::OnLayoutChanged: Warning - No window found to add subview\n");
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
    
    if ([NSThread isMainThread]) {
        [container.scintillaView message:SCI_SETTEXT wParam:0 lParam:(sptr_t)text.c_str()];
        [container.scintillaView setNeedsDisplay:YES];
    } else {
        // Dispatch to main thread for UI access
        // We must ensure 'text' is copied into the block, not captured by reference to stack variable
        dispatch_async(dispatch_get_main_queue(), ^{
            [container.scintillaView message:SCI_SETTEXT wParam:0 lParam:(sptr_t)text.c_str()];
            [container.scintillaView setNeedsDisplay:YES];
        });
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
        [container.scintillaView message:SCI_STARTSTYLING wParam:startPos lParam:0];
        [container.scintillaView message:SCI_SETSTYLINGEX wParam:length lParam:(sptr_t)styleData.c_str()];
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

void ScintillaView::ShowCalltip(int bytePos, const std::string& text) {
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    std::string textCopy = text;
    auto doShow = ^{
        [container.scintillaView message:SCI_CALLTIPSHOW wParam:bytePos lParam:(sptr_t)textCopy.c_str()];
    };
    if ([NSThread isMainThread]) doShow();
    else dispatch_async(dispatch_get_main_queue(), doShow);
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
    else dispatch_async(dispatch_get_main_queue(), doHide);
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
#ifdef __APPLE__
    if (!cocoa_view_) return;
    ScintillaViewContainer* container = (__bridge ScintillaViewContainer*)cocoa_view_;
    auto doDetach = ^{
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
