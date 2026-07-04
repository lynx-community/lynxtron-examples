cmake_minimum_required(VERSION 3.20)
project(lynx_http_service_module LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(LYNX_HEADERS_INCLUDE "${CMAKE_SOURCE_DIR}/node_modules/@lynx-js/lynx-library-headers/include")

# ---------------------------------------------------------------------------
# 1. bindings_lib — uses standard napi.h (no namespace remap)
# ---------------------------------------------------------------------------
add_library(bindings_lib OBJECT
  bindings/bind_napi.cc
)
target_include_directories(bindings_lib PRIVATE
  ${CMAKE_JS_INC}
  ${CMAKE_SOURCE_DIR}
  "${LYNX_HEADERS_INCLUDE}"
)

# ---------------------------------------------------------------------------
# 2. module_lib — uses weak-node-api namespace remap
#    Contains the extension module class and the platform HTTP backend.
# ---------------------------------------------------------------------------
set(HTTP_SERVICE_SOURCES
  module/http_service_extension_module.cc
  module/http_service_extension_module.h
)
if(APPLE)
  list(APPEND HTTP_SERVICE_SOURCES module/http_service_darwin.mm)
elseif(WIN32)
  list(APPEND HTTP_SERVICE_SOURCES module/http_service_win.cc)
else()
  message(FATAL_ERROR "lynxtron-http-service only supports macOS and Windows")
endif()

add_library(module_lib OBJECT
  ${HTTP_SERVICE_SOURCES}
)
target_include_directories(module_lib PRIVATE
  ${CMAKE_JS_INC}
  ${CMAKE_SOURCE_DIR}
  "${LYNX_HEADERS_INCLUDE}"
)
target_compile_definitions(module_lib PRIVATE
  NAPI_CPP_CUSTOM_NAMESPACE=weak_node_api
  USE_WEAK_SUFFIX_NAPI
  NAPI_DISABLE_CPP_RTTI
  NAPI_DISABLE_CPP_EXCEPTIONS
)
if(MSVC)
  target_compile_options(module_lib PRIVATE /EHsc)
else()
  target_compile_options(module_lib PRIVATE -fPIC -fvisibility=hidden)
endif()
if(APPLE)
  set_source_files_properties(module/http_service_darwin.mm PROPERTIES COMPILE_FLAGS "-fobjc-arc")
endif()

# ---------------------------------------------------------------------------
# 3. Main shared lib — links objects from both
# ---------------------------------------------------------------------------
add_library(${PROJECT_NAME} SHARED
  ${CMAKE_JS_SRC}
  $<TARGET_OBJECTS:bindings_lib>
  $<TARGET_OBJECTS:module_lib>
)

set_target_properties(${PROJECT_NAME} PROPERTIES
  PREFIX ""
  SUFFIX ".node"
)

target_include_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_JS_INC}
  ${CMAKE_SOURCE_DIR}
  "${LYNX_HEADERS_INCLUDE}"
)

if(MSVC)
  target_compile_options(${PROJECT_NAME} PRIVATE /EHsc)
else()
  target_compile_options(${PROJECT_NAME} PRIVATE -fPIC -fvisibility=hidden)
endif()

if(APPLE)
  set_target_properties(${PROJECT_NAME} PROPERTIES
    MACOSX_RPATH ON
    LINK_FLAGS "-undefined dynamic_lookup"
  )
  find_library(FOUNDATION_FRAMEWORK Foundation)
  target_link_libraries(${PROJECT_NAME} PRIVATE
    ${FOUNDATION_FRAMEWORK}
  )
elseif(WIN32)
  # Lynxtron runtime layout changed: import libs now live directly under `dist/`.
  set(LYNXTRON_RUNTIME_DIR "${CMAKE_SOURCE_DIR}/../node_modules/@lynx-js/lynxtron/dist")
  set(LYNXTRON_IMPORT_LIB "${LYNXTRON_RUNTIME_DIR}/lynxtron.dll.lib")
  if(NOT EXISTS "${LYNXTRON_IMPORT_LIB}")
    set(LYNXTRON_RUNTIME_DIR "${CMAKE_SOURCE_DIR}/../node_modules/@lynx-js/lynxtron/dist/win32/x64")
    set(LYNXTRON_IMPORT_LIB "${LYNXTRON_RUNTIME_DIR}/lynxtron.dll.lib")
  endif()
  if(NOT EXISTS "${LYNXTRON_IMPORT_LIB}")
    message(FATAL_ERROR "Lynxtron Windows import library not found: ${LYNXTRON_IMPORT_LIB}")
  endif()

  target_compile_definitions(${PROJECT_NAME} PRIVATE
    WIN32_LEAN_AND_MEAN
    NOMINMAX
    UNICODE
    _UNICODE
    _CRT_SECURE_NO_WARNINGS
  )
  target_link_libraries(${PROJECT_NAME} PRIVATE
    ${CMAKE_JS_LIB}
    "${LYNXTRON_IMPORT_LIB}"
    winhttp
  )
endif()
