cmake_minimum_required(VERSION 3.20)
project(lynx_scintilla_module LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Scintilla Support (static lib, independent of napi)
add_subdirectory(scintilla)

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
#    Contains the C++ module class and the platform native view.
# ---------------------------------------------------------------------------
set(SCINTILLA_VIEW_SOURCES
  module/scintilla_extension_module.cc
  module/scintilla_extension_module.h
  module/scintilla_view.h
)
if(APPLE)
  list(APPEND SCINTILLA_VIEW_SOURCES module/scintilla_view.mm)
elseif(WIN32)
  list(APPEND SCINTILLA_VIEW_SOURCES module/scintilla_view_win.cc)
else()
  message(FATAL_ERROR "lynxtron-scintilla-editor only supports macOS and Windows")
endif()

add_library(module_lib OBJECT
  ${SCINTILLA_VIEW_SOURCES}
)
target_include_directories(module_lib PRIVATE
  ${CMAKE_JS_INC}
  ${CMAKE_SOURCE_DIR}
  "${LYNX_HEADERS_INCLUDE}"
  "${CMAKE_SOURCE_DIR}/scintilla/include"
  "${CMAKE_SOURCE_DIR}/scintilla/src"
  "${CMAKE_SOURCE_DIR}/scintilla/lexlib"
  "${CMAKE_SOURCE_DIR}/scintilla/call"
)
if(APPLE)
  target_include_directories(module_lib PRIVATE "${CMAKE_SOURCE_DIR}/scintilla/cocoa")
elseif(WIN32)
  target_include_directories(module_lib PRIVATE "${CMAKE_SOURCE_DIR}/scintilla/win32")
endif()
target_compile_definitions(module_lib PRIVATE
  NAPI_CPP_CUSTOM_NAMESPACE=weak_node_api
  USE_WEAK_SUFFIX_NAPI
  NAPI_DISABLE_CPP_RTTI
  NAPI_DISABLE_CPP_EXCEPTIONS
  SCI_NAMESPACE
)
if(MSVC)
  target_compile_options(module_lib PRIVATE /EHsc /bigobj)
else()
  target_compile_options(module_lib PRIVATE -fPIC -fvisibility=hidden)
endif()
if(APPLE)
  set_source_files_properties(module/scintilla_view.mm PROPERTIES COMPILE_FLAGS "-fobjc-arc")
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

target_compile_definitions(${PROJECT_NAME} PRIVATE
  SCI_NAMESPACE
)

if(MSVC)
  target_compile_options(${PROJECT_NAME} PRIVATE /EHsc /bigobj)
else()
  target_compile_options(${PROJECT_NAME} PRIVATE -fPIC -fvisibility=hidden)
endif()

if(APPLE)
  set_target_properties(${PROJECT_NAME} PROPERTIES
    MACOSX_RPATH ON
    LINK_FLAGS "-undefined dynamic_lookup"
  )
  find_library(CORE_FOUNDATION_FRAMEWORK CoreFoundation)
  find_library(IO_SURFACE_FRAMEWORK IOSurface)
  find_library(CORE_GRAPHICS_FRAMEWORK CoreGraphics)
  find_library(CORE_TEXT_FRAMEWORK CoreText)
  find_library(COCOA_FRAMEWORK Cocoa)
  find_library(QUARTZ_FRAMEWORK QuartzCore)
  find_library(IMAGE_IO_FRAMEWORK ImageIO)
  find_library(CORE_SERVICES_FRAMEWORK CoreServices)

  target_link_libraries(${PROJECT_NAME} PRIVATE
    scintilla
    ${CORE_FOUNDATION_FRAMEWORK}
    ${IO_SURFACE_FRAMEWORK}
    ${CORE_GRAPHICS_FRAMEWORK}
    ${CORE_TEXT_FRAMEWORK}
    ${COCOA_FRAMEWORK}
    ${QUARTZ_FRAMEWORK}
    ${IMAGE_IO_FRAMEWORK}
    ${CORE_SERVICES_FRAMEWORK}
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
    scintilla
    user32
    gdi32
    imm32
    ole32
    oleaut32
    advapi32
    comctl32
    d2d1
    dwrite
    d3d11
  )
endif()
