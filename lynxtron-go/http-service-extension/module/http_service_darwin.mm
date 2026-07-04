// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
#import <Foundation/Foundation.h>

#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>

#include "module/http_service_extension_module.h"

namespace extension {
namespace {

// NSURLSession-backed LynxHttpService. Request() is called on an engine
// thread and must not block: the session dispatches the completion handler
// on its own queue, where the response is filled in and Complete()d. The
// shared_ptr<LynxHttpResponse> captured by the block keeps the underlying
// lynx_http_response_t alive until then.
class DarwinHttpService : public lynx::pub::LynxHttpService {
 public:
  DarwinHttpService() {
    NSURLSessionConfiguration* config =
        [NSURLSessionConfiguration ephemeralSessionConfiguration];
    config.timeoutIntervalForRequest = 30.0;
    session_ = [NSURLSession sessionWithConfiguration:config];
  }

  ~DarwinHttpService() override { [session_ invalidateAndCancel]; }

  void Request(std::shared_ptr<lynx::pub::LynxHttpRequest> request,
               std::shared_ptr<lynx::pub::LynxHttpResponse> response) override {
    NSString* url_string =
        [NSString stringWithUTF8String:request->GetUrl().c_str()];
    NSURL* url = [NSURL URLWithString:url_string];
    if (!url) {
      response->SetStatusCode(-1);
      response->SetStatusText("Invalid URL");
      response->Complete();
      return;
    }

    NSMutableURLRequest* ns_request = [NSMutableURLRequest requestWithURL:url];
    const std::string& method = request->GetMethod();
    ns_request.HTTPMethod = method.empty()
        ? @"GET"
        : [NSString stringWithUTF8String:method.c_str()];
    for (const auto& [key, value] : request->GetHeaders()) {
      [ns_request setValue:[NSString stringWithUTF8String:value.c_str()]
          forHTTPHeaderField:[NSString stringWithUTF8String:key.c_str()]];
    }
    const auto& body = request->GetBody();
    if (!body.empty()) {
      ns_request.HTTPBody = [NSData dataWithBytes:body.data()
                                           length:body.size()];
    }

    NSURLSessionDataTask* task = [session_
        dataTaskWithRequest:ns_request
          completionHandler:^(NSData* data, NSURLResponse* ns_response,
                              NSError* error) {
            if (error) {
              response->SetStatusCode(-1);
              response->SetStatusText(
                  error.localizedDescription.UTF8String ?: "Network error");
              response->Complete();
              return;
            }

            NSInteger status = 200;
            if ([ns_response isKindOfClass:[NSHTTPURLResponse class]]) {
              NSHTTPURLResponse* http = (NSHTTPURLResponse*)ns_response;
              status = http.statusCode;
              [http.allHeaderFields enumerateKeysAndObjectsUsingBlock:^(
                                        id key, id value, BOOL* stop) {
                NSString* key_str = [key description];
                NSString* value_str = [value description];
                response->AddHeader(key_str.UTF8String ?: "",
                                    value_str.UTF8String ?: "");
              }];
            }
            response->SetStatusCode((int)status);
            NSString* status_text =
                [NSHTTPURLResponse localizedStringForStatusCode:status];
            response->SetStatusText(status_text.UTF8String ?: "");

            if (data.length > 0) {
              // The engine consumes the body asynchronously after Complete();
              // hand it a malloc'd copy with a matching destructor.
              uint8_t* copy = static_cast<uint8_t*>(malloc(data.length));
              memcpy(copy, data.bytes, data.length);
              response->SetBody(
                  copy, data.length,
                  [](uint8_t* content, size_t, void*) { free(content); },
                  nullptr);
            }
            response->Complete();
          }];
    [task resume];
  }

 private:
  NSURLSession* session_;
};

}  // namespace

std::shared_ptr<lynx::pub::LynxHttpService> CreatePlatformHttpService() {
  return std::make_shared<DarwinHttpService>();
}

}  // namespace extension
