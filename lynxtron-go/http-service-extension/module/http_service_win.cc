// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#include <windows.h>
#include <winhttp.h>

#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "module/http_service_extension_module.h"

namespace extension {
namespace {

std::wstring Widen(const std::string& value) {
  if (value.empty()) return std::wstring();
  int size = ::MultiByteToWideChar(CP_UTF8, 0, value.data(),
                                   static_cast<int>(value.size()), nullptr, 0);
  std::wstring result(size, L'\0');
  ::MultiByteToWideChar(CP_UTF8, 0, value.data(),
                        static_cast<int>(value.size()), result.data(), size);
  return result;
}

std::string Narrow(const std::wstring& value) {
  if (value.empty()) return std::string();
  int size = ::WideCharToMultiByte(CP_UTF8, 0, value.data(),
                                   static_cast<int>(value.size()), nullptr, 0,
                                   nullptr, nullptr);
  std::string result(size, '\0');
  ::WideCharToMultiByte(CP_UTF8, 0, value.data(),
                        static_cast<int>(value.size()), result.data(), size,
                        nullptr, nullptr);
  return result;
}

void FailResponse(std::shared_ptr<lynx::pub::LynxHttpResponse> response,
                  const char* message) {
  response->SetStatusCode(-1);
  response->SetStatusText(message);
  response->Complete();
}

// WinHTTP-backed LynxHttpService. Request() must not block the engine
// thread, so each request runs on a detached worker thread using the
// straightforward synchronous WinHTTP flow.
class WinHttpService : public lynx::pub::LynxHttpService {
 public:
  WinHttpService() = default;
  ~WinHttpService() override = default;

  void Request(std::shared_ptr<lynx::pub::LynxHttpRequest> request,
               std::shared_ptr<lynx::pub::LynxHttpResponse> response) override {
    std::thread([request, response] { RunRequest(request, response); })
        .detach();
  }

 private:
  static void RunRequest(
      std::shared_ptr<lynx::pub::LynxHttpRequest> request,
      std::shared_ptr<lynx::pub::LynxHttpResponse> response) {
    std::wstring url = Widen(request->GetUrl());

    URL_COMPONENTS parts = {};
    parts.dwStructSize = sizeof(parts);
    wchar_t host[256] = {};
    wchar_t path[4096] = {};
    parts.lpszHostName = host;
    parts.dwHostNameLength = ARRAYSIZE(host);
    parts.lpszUrlPath = path;
    parts.dwUrlPathLength = ARRAYSIZE(path);
    if (!::WinHttpCrackUrl(url.c_str(), 0, 0, &parts)) {
      FailResponse(response, "Invalid URL");
      return;
    }

    HINTERNET session = ::WinHttpOpen(
        L"LynxtronHttpService/1.0", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
        WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!session) {
      FailResponse(response, "WinHttpOpen failed");
      return;
    }

    HINTERNET connect =
        ::WinHttpConnect(session, host, parts.nPort, 0);
    if (!connect) {
      ::WinHttpCloseHandle(session);
      FailResponse(response, "WinHttpConnect failed");
      return;
    }

    std::wstring method = Widen(
        request->GetMethod().empty() ? "GET" : request->GetMethod());
    DWORD flags = parts.nScheme == INTERNET_SCHEME_HTTPS
                      ? WINHTTP_FLAG_SECURE
                      : 0;
    HINTERNET handle = ::WinHttpOpenRequest(
        connect, method.c_str(), path, nullptr, WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
    if (!handle) {
      ::WinHttpCloseHandle(connect);
      ::WinHttpCloseHandle(session);
      FailResponse(response, "WinHttpOpenRequest failed");
      return;
    }

    std::wstring headers;
    for (const auto& [key, value] : request->GetHeaders()) {
      headers += Widen(key) + L": " + Widen(value) + L"\r\n";
    }

    const auto& body = request->GetBody();
    BOOL sent = ::WinHttpSendRequest(
        handle,
        headers.empty() ? WINHTTP_NO_ADDITIONAL_HEADERS : headers.c_str(),
        headers.empty() ? 0 : static_cast<DWORD>(-1),
        body.empty() ? WINHTTP_NO_REQUEST_DATA
                     : const_cast<uint8_t*>(body.data()),
        static_cast<DWORD>(body.size()), static_cast<DWORD>(body.size()), 0);
    if (!sent || !::WinHttpReceiveResponse(handle, nullptr)) {
      ::WinHttpCloseHandle(handle);
      ::WinHttpCloseHandle(connect);
      ::WinHttpCloseHandle(session);
      FailResponse(response, "Network error");
      return;
    }

    DWORD status = 0;
    DWORD status_size = sizeof(status);
    ::WinHttpQueryHeaders(
        handle, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
        WINHTTP_HEADER_NAME_BY_INDEX, &status, &status_size,
        WINHTTP_NO_HEADER_INDEX);
    response->SetStatusCode(static_cast<int>(status));

    DWORD raw_size = 0;
    ::WinHttpQueryHeaders(handle, WINHTTP_QUERY_RAW_HEADERS_CRLF,
                          WINHTTP_HEADER_NAME_BY_INDEX,
                          WINHTTP_NO_OUTPUT_BUFFER, &raw_size,
                          WINHTTP_NO_HEADER_INDEX);
    if (raw_size > 0) {
      std::wstring raw(raw_size / sizeof(wchar_t), L'\0');
      if (::WinHttpQueryHeaders(handle, WINHTTP_QUERY_RAW_HEADERS_CRLF,
                                WINHTTP_HEADER_NAME_BY_INDEX, raw.data(),
                                &raw_size, WINHTTP_NO_HEADER_INDEX)) {
        std::string raw_utf8 = Narrow(raw);
        size_t line_start = raw_utf8.find("\r\n");  // skip the status line
        while (line_start != std::string::npos) {
          line_start += 2;
          size_t line_end = raw_utf8.find("\r\n", line_start);
          if (line_end == std::string::npos || line_end == line_start) break;
          std::string line = raw_utf8.substr(line_start, line_end - line_start);
          size_t colon = line.find(':');
          if (colon != std::string::npos) {
            std::string key = line.substr(0, colon);
            size_t value_start = line.find_first_not_of(' ', colon + 1);
            std::string value = value_start == std::string::npos
                                    ? ""
                                    : line.substr(value_start);
            response->AddHeader(key, value);
          }
          line_start = line_end;
        }
      }
    }

    std::vector<uint8_t> data;
    for (;;) {
      DWORD available = 0;
      if (!::WinHttpQueryDataAvailable(handle, &available) || available == 0) {
        break;
      }
      size_t offset = data.size();
      data.resize(offset + available);
      DWORD read = 0;
      if (!::WinHttpReadData(handle, data.data() + offset, available, &read)) {
        break;
      }
      data.resize(offset + read);
      if (read == 0) break;
    }

    ::WinHttpCloseHandle(handle);
    ::WinHttpCloseHandle(connect);
    ::WinHttpCloseHandle(session);

    if (!data.empty()) {
      uint8_t* copy = static_cast<uint8_t*>(malloc(data.size()));
      memcpy(copy, data.data(), data.size());
      response->SetBody(
          copy, data.size(),
          [](uint8_t* content, size_t, void*) { free(content); }, nullptr);
    }
    response->Complete();
  }
};

}  // namespace

std::shared_ptr<lynx::pub::LynxHttpService> CreatePlatformHttpService() {
  return std::make_shared<WinHttpService>();
}

}  // namespace extension
