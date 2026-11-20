cmake_minimum_required(VERSION 3.20)
project(system_webview LANGUAGES CXX)

include(FetchContent)
FetchContent_Declare(webview2
  URL https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.3537.50/microsoft.web.webview2.1.0.3537.50.nupkg
  URL_HASH SHA256=5ea526bbd728adda0da4d31219267e96460494a427e4894c4e09d9f320f4b9aa
  DOWNLOAD_NAME webview2.zip
)
FetchContent_MakeAvailable(webview2)
set(sdk "${webview2_SOURCE_DIR}/build/native")

add_library(system_webview MODULE system_webview_win.cc)
target_compile_features(system_webview PRIVATE cxx_std_17)
target_compile_definitions(system_webview PRIVATE UNICODE _UNICODE NOMINMAX)
target_include_directories(system_webview PRIVATE "${sdk}/include" "${LYNX_HEADERS}/include")
include("${LYNX_HEADERS}/cmake/lynx-library-headers.cmake")
lynx_link_lynxtron_runtime(system_webview)
target_link_libraries(system_webview PRIVATE "${sdk}/x64/WebView2LoaderStatic.lib"
  ole32 shell32 uuid version user32 shlwapi advapi32)
set_target_properties(system_webview PROPERTIES PREFIX "" SUFFIX ".node"
  LIBRARY_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}/build"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}/build")
