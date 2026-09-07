// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#pragma once
#include <unordered_map>
#include <cstdint>

// The host paints the gutters; Scintilla remains the source of scroll state.
// Like the Cocoa host, use STYLE_DEFAULT for the track and corner background.
namespace editor_scrollbars {
struct Drag {
  int axis = -1;
  int offset = 0;
  int hover = -1;
  int remainder = 0;
  double wheel_remainder = 0;
};
inline std::unordered_map<HWND, Drag> states;
inline int Thickness(HWND host) {
  return std::max(1, MulDiv(12, GetDpiForWindow(host), 96));
}
inline LRESULT Send(HWND editor, UINT msg, WPARAM value = 0) {
  return SendMessageW(editor, msg, value, 0);
}
inline void Layout(HWND host, HWND editor, int width, int height) {
  const int bar = Thickness(host);
  const int line_height = std::max(1, static_cast<int>(Send(editor, SCI_TEXTHEIGHT)));
  const int remainder = states[host].remainder % line_height;
  states[host].remainder = remainder;
  // Clip the fractional first line in the host, as NSClipView does on macOS.
  // Mouse/selection coordinates remain local to the real editor HWND.
  SetWindowPos(editor, HWND_TOP, 0, -remainder, std::max(0, width - bar),
               std::max(0, height - bar) + remainder, SWP_SHOWWINDOW | SWP_NOACTIVATE);
  InvalidateRect(host, nullptr, FALSE);
}
struct Metrics {
  RECT track{};
  RECT thumb{};
  int length = 0;
  int thumb_length = 0;
  int page = 0;
  int maximum = 0;
  int position = 0;
};
inline Metrics Measure(HWND host, HWND editor, int axis) {
  RECT rect{};
  GetClientRect(host, &rect);
  const int bar = Thickness(host);
  Metrics m;
  m.track = axis == 0 ? RECT{0, std::max(0L, rect.bottom - bar),
                            std::max(0L, rect.right - bar), rect.bottom}
                      : RECT{std::max(0L, rect.right - bar), 0, rect.right,
                             std::max(0L, rect.bottom - bar)};
  m.length = axis == 0 ? m.track.right : m.track.bottom;
  if (axis == 0) {
    m.page = m.length;
    // Scintilla reserves the fixed margin on the left of its text viewport.
    const int margins = static_cast<int>(Send(editor, SCI_GETMARGINS));
    for (int i = 0; i < margins; ++i)
      m.page -= static_cast<int>(Send(editor, SCI_GETMARGINWIDTHN, i));
    m.page = std::max(1, m.page);
    m.maximum = std::max(0, static_cast<int>(Send(editor, SCI_GETSCROLLWIDTH)) - m.page);
    m.position = static_cast<int>(Send(editor, SCI_GETXOFFSET));
  } else {
    const int line_height = std::max(1, static_cast<int>(Send(editor, SCI_TEXTHEIGHT)));
    m.page = std::max(1, m.length);
    const auto lines = Send(editor, SCI_GETLINECOUNT);
    const int last = static_cast<int>(Send(editor, SCI_VISIBLEFROMDOCLINE, std::max<LRESULT>(0, lines - 1)));
    const int wrapped = static_cast<int>(Send(editor, SCI_WRAPCOUNT, std::max<LRESULT>(0, lines - 1)));
    m.maximum = std::max(0, (last + wrapped) * line_height - m.page);
    m.position = static_cast<int>(Send(editor, SCI_GETFIRSTVISIBLELINE)) * line_height + states[host].remainder;
  }
  m.position = std::clamp(m.position, 0, m.maximum);
  const int total = m.maximum + m.page;
  m.thumb_length = std::min(m.length, std::max(bar * 2,
      total ? static_cast<int>(static_cast<int64_t>(m.length) * m.page / total) : m.length));
  const int start = m.maximum ? static_cast<int>(static_cast<int64_t>(m.length - m.thumb_length) * m.position / m.maximum) : 0;
  m.thumb = m.track;
  const int inset = std::max(1, bar / 4);
  if (axis == 0) {
    m.thumb.left = start; m.thumb.right = start + m.thumb_length;
    m.thumb.top += inset; m.thumb.bottom -= inset;
  } else {
    m.thumb.top = start; m.thumb.bottom = start + m.thumb_length;
    m.thumb.left += inset; m.thumb.right -= inset;
  }
  return m;
}
inline void SetPosition(HWND host, HWND editor, int axis, int position) {
  if (axis == 0) { Send(editor, SCI_SETXOFFSET, position); return; }
  const int line_height = std::max(1, static_cast<int>(Send(editor, SCI_TEXTHEIGHT)));
  states[host].remainder = position % line_height;
  RECT rect{};
  GetClientRect(host, &rect);
  Layout(host, editor, rect.right, rect.bottom);
  Send(editor, SCI_SETFIRSTVISIBLELINE, position / line_height);
}
inline void Wheel(HWND host, HWND editor, WPARAM wp) {
  UINT lines = 3;
  SystemParametersInfoW(SPI_GETWHEELSCROLLLINES, 0, &lines, 0);
  const auto m = Measure(host, editor, 1);
  const int line_height = std::max(1, static_cast<int>(Send(editor, SCI_TEXTHEIGHT)));
  const double step = lines == WHEEL_PAGESCROLL ? m.page : static_cast<double>(lines) * line_height;
  auto& state = states[host];
  const double delta = state.wheel_remainder - static_cast<short>(HIWORD(wp)) * step / WHEEL_DELTA;
  const int pixels = static_cast<int>(delta);
  state.wheel_remainder = delta - pixels;
  SetPosition(host, editor, 1, std::clamp(m.position + pixels, 0, m.maximum));
}
inline void Paint(HWND host, HWND editor, HDC dc) {
  const COLORREF background = static_cast<COLORREF>(Send(editor, SCI_STYLEGETBACK, STYLE_DEFAULT));
  const bool dark = GetRValue(background) + GetGValue(background) + GetBValue(background) < 384;
  for (int axis = 0; axis < 2; ++axis) {
    const auto m = Measure(host, editor, axis);
    if (!m.maximum) continue;
    const auto& state = states[host];
    const bool active = state.axis == axis || state.hover == axis;
    const int shade = dark ? (active ? 157 : 108) : (active ? 105 : 160);
    HBRUSH brush = CreateSolidBrush(RGB(shade, shade, shade));
    auto old_brush = SelectObject(dc, brush);
    auto old_pen = SelectObject(dc, GetStockObject(NULL_PEN));
    const int radius = Thickness(host);
    RoundRect(dc, m.thumb.left, m.thumb.top, m.thumb.right, m.thumb.bottom, radius, radius);
    SelectObject(dc, old_pen); SelectObject(dc, old_brush); DeleteObject(brush);
  }
}
inline bool Input(HWND host, HWND editor, UINT message, WPARAM, LPARAM lp) {
  if (message == WM_NCDESTROY) { states.erase(host); return false; }
  if (message != WM_LBUTTONDOWN && message != WM_MOUSEMOVE &&
      message != WM_LBUTTONUP && message != WM_CAPTURECHANGED &&
      message != WM_MOUSELEAVE) return false;
  auto& state = states[host];
  const POINT point{static_cast<short>(LOWORD(lp)), static_cast<short>(HIWORD(lp))};
  if (message == WM_LBUTTONUP || message == WM_CAPTURECHANGED) {
    state.axis = -1;
    if (message == WM_LBUTTONUP && GetCapture() == host) ReleaseCapture();
  } else if (message == WM_MOUSELEAVE) {
    state.hover = -1;
  } else if (message == WM_LBUTTONDOWN) {
    for (int axis = 0; axis < 2; ++axis) {
      const auto m = Measure(host, editor, axis);
      if (!m.maximum || !PtInRect(&m.track, point)) continue;
      const int coordinate = axis == 0 ? point.x : point.y;
      const int start = axis == 0 ? m.thumb.left : m.thumb.top;
      if (coordinate >= start && coordinate < start + m.thumb_length) {
        state.axis = axis; state.offset = coordinate - start; SetCapture(host);
      } else {
        const int position = std::clamp(m.position + (coordinate < start ? -m.page : m.page), 0, m.maximum);
        SetPosition(host, editor, axis, position);
      }
      break;
    }
  } else if (state.axis >= 0) {
    const auto m = Measure(host, editor, state.axis);
    const int travel = m.length - m.thumb_length;
    const int coordinate = state.axis == 0 ? point.x : point.y;
    if (travel > 0) {
      const int position = static_cast<int>(static_cast<int64_t>(std::clamp(coordinate - state.offset, 0, travel)) * m.maximum / travel);
      SetPosition(host, editor, state.axis, position);
    }
  } else {
    state.hover = -1;
    for (int axis = 0; axis < 2; ++axis) {
      const auto m = Measure(host, editor, axis);
      if (PtInRect(&m.track, point)) state.hover = axis;
    }
    TRACKMOUSEEVENT track{sizeof(track), TME_LEAVE, host, 0};
    TrackMouseEvent(&track);
  }
  InvalidateRect(host, nullptr, FALSE);
  return true;
}
}  // namespace editor_scrollbars
