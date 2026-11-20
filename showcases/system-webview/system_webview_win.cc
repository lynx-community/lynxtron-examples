#include <windows.h>
#include <shlobj.h>
#include <wrl.h>
#include <WebView2.h>

#include <lynx/registration.h>
#include <lynx_native_view.h>

#include <cmath>
#include <cstdio>
#include <memory>
#include <string>

namespace {
using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

bool Succeeded(HRESULT hr, const char* operation) {
  if (SUCCEEDED(hr)) return true;
  std::fprintf(stderr, "System WebView: %s failed (0x%08lx).\n", operation,
               static_cast<unsigned long>(hr));
  return false;
}

// The controller and its callbacks run on the window's STA thread. Callbacks
// hold only a weak reference: the Lynx element can disappear during creation.
struct ViewState {
  ComPtr<ICoreWebView2Controller> controller;
  ComPtr<ICoreWebView2> web;
  std::wstring content;
  bool is_url = false;
  RECT bounds{};
  bool attached = false;
  bool started = false;

  ~ViewState() {
    if (controller) controller->Close();
  }

  void Navigate() {
    if (!web || content.empty()) return;
    Succeeded(is_url ? web->Navigate(content.c_str()) : web->NavigateToString(content.c_str()),
              "navigate WebView2");
  }

  void UpdateLayout() {
    if (!controller) return;
    controller->put_Bounds(bounds);
    controller->put_IsVisible(attached && !IsRectEmpty(&bounds));
  }
};

class SystemWebView final : public lynx::pub::LynxNativeView {
 public:
  explicit SystemWebView(lynx_view_t* host) : host_(host) {}

  bool OnCreate() override {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    com_initialized_ = Succeeded(hr, "initialize STA");
    return com_initialized_;
  }

  void OnAttach() override {
    state_->attached = true;
    Update();
  }

  void OnDetach() override {
    state_->attached = false;
    state_->UpdateLayout();
  }

  void OnLayoutChanged(float left, float top, float width, float height,
                       float scale) override {
    auto pixels = [scale](float v) { return std::lround(v * scale); };
    state_->bounds = {pixels(left), pixels(top), pixels(left + width), pixels(top + height)};
    Update();
  }

  void OnPropertiesChanged(const lynx::pub::LynxValue& attrs,
                           const lynx::pub::LynxValue&) override {
    auto src = attrs.GetProperty("src");
    bool is_url = src.Type() == lynx_value_string;
    auto value = is_url ? attrs.GetProperty("src") : attrs.GetProperty("html");
    if (value.Type() != lynx_value_string) return;
    auto utf8 = value.StdString();
    if (is_url && utf8.rfind("https://", 0) != 0) return;
    int size = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, nullptr, 0);
    if (!size) return;
    std::wstring content(size, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, content.data(), size);
    content.resize(size - 1);
    state_->is_url = is_url;
    state_->content = std::move(content);
    state_->Navigate();
  }

  ~SystemWebView() override {
    state_.reset();
    if (com_initialized_) CoUninitialize();
  }

 private:
  void Update() {
    if (state_->started || !state_->attached || IsRectEmpty(&state_->bounds)) {
      state_->UpdateLayout();
      return;
    }
    HWND parent = reinterpret_cast<HWND>(lynx_view_get_native_window(host_));
    if (!parent) return;
    state_->started = true;
    PWSTR local = nullptr;
    if (!Succeeded(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &local),
                   "find local app data")) return;
    std::wstring profile = std::wstring(local) + L"\\LynxtronSystemWebViewExample";
    CoTaskMemFree(local);

    std::weak_ptr<ViewState> weak = state_;
    auto on_controller = Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
        [weak](HRESULT hr, ICoreWebView2Controller* controller) -> HRESULT {
          auto state = weak.lock();
          if (!state) {
            if (controller) controller->Close();
            return S_OK;
          }
          if (!Succeeded(hr, "create WebView2 controller") || !controller) return S_OK;
          state->controller = controller;
          if (!Succeeded(controller->get_CoreWebView2(&state->web), "get WebView2")) return S_OK;
          state->UpdateLayout();
          state->Navigate();
          return S_OK;
        });
    auto on_environment = Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
        [weak, parent, on_controller](HRESULT hr, ICoreWebView2Environment* env) -> HRESULT {
          if (weak.expired()) return S_OK;
          if (Succeeded(hr, "open installed Evergreen WebView2 Runtime") && env)
            Succeeded(env->CreateCoreWebView2Controller(parent, on_controller.Get()), "request controller");
          return S_OK;
        });
    Succeeded(CreateCoreWebView2EnvironmentWithOptions(nullptr, profile.c_str(), nullptr,
                  on_environment.Get()), "locate installed Evergreen WebView2 Runtime");
  }

  lynx_view_t* host_;
  std::shared_ptr<ViewState> state_ = std::make_shared<ViewState>();
  bool com_initialized_ = false;
};

lynx_native_view_t* CreateView(void* host) {
  return (new SystemWebView(static_cast<lynx_view_t*>(host)))->native_view();
}
}  // namespace

LYNX_REGISTER_ELEMENT("SystemWebView", "system-webview", CreateView, false, nullptr)
NAPI_MODULE_INIT() { return exports; }
