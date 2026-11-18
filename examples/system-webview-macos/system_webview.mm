#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>

#include <lynx/registration.h>
#include <lynx_native_view.h>

namespace {
class SystemWebView final : public lynx::pub::LynxNativeView {
 public:
  explicit SystemWebView(lynx_view_t* host) : host_(host) {}

  bool OnCreate() override {
    web_ = [[WKWebView alloc] initWithFrame:NSZeroRect
                              configuration:[WKWebViewConfiguration new]];
    // Keep the platform view above the renderer’s compositing layer.
    web_.wantsLayer = YES;
    web_.layer.zPosition = 1;
    return web_ != nil;
  }

  void OnPropertiesChanged(const lynx::pub::LynxValue& attrs,
                           const lynx::pub::LynxValue&) override {
    auto html = attrs.GetProperty("html");
    if (html.Type() == lynx_value_string) {
      [web_ loadHTMLString:[NSString stringWithUTF8String:html.StdString().c_str()]
                   baseURL:nil];
    }
  }

  void OnLayoutChanged(float left, float top, float width, float height, float) override {
    frame_ = NSMakeRect(left, top, width, height);
    if (attached_) Mount();
  }

  void OnAttach() override {
    attached_ = true;
    Mount();
  }

  void OnDetach() override {
    attached_ = false;
    [web_ removeFromSuperview];
  }

  void OnDestroy() override {
    [web_ stopLoading];
    [web_ removeFromSuperview];
    web_ = nil;
  }

 private:
  void Mount() {
    NSView* parent = (__bridge NSView*)lynx_view_get_native_window(host_);
    if (!parent || !web_) return;
    NSRect rect = frame_;
    if (!parent.isFlipped) rect.origin.y = NSHeight(parent.bounds) - NSMaxY(rect);
    web_.frame = rect;
    if (web_.superview != parent) [parent addSubview:web_];
  }

  lynx_view_t* host_;
  WKWebView* web_ = nil;
  NSRect frame_ = NSZeroRect;
  bool attached_ = false;
};

lynx_native_view_t* CreateView(void* host) {
  return (new SystemWebView(static_cast<lynx_view_t*>(host)))->native_view();
}
}  // namespace

LYNX_REGISTER_ELEMENT("SystemWebView", "system-webview", CreateView, false, nullptr)
NAPI_MODULE_INIT() { return exports; }
