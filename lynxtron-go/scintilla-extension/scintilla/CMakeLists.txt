cmake_minimum_required(VERSION 3.10)

project(scintilla_lib)

# Headers
file(GLOB SCINTILLA_INCLUDE "${CMAKE_CURRENT_SOURCE_DIR}/include/*.h")
file(GLOB SCINTILLA_SRC_H "${CMAKE_CURRENT_SOURCE_DIR}/src/*.h")
file(GLOB SCINTILLA_LEXLIB_H "${CMAKE_CURRENT_SOURCE_DIR}/lexlib/*.h")

# Source
file(GLOB SCINTILLA_SRC_CPP "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cxx")
file(GLOB SCINTILLA_CALL_CPP "${CMAKE_CURRENT_SOURCE_DIR}/call/*.cxx")
file(GLOB SCINTILLA_LEXLIB_CPP "${CMAKE_CURRENT_SOURCE_DIR}/lexlib/*.cxx")

# Lexers - Include all for now, can be optimized later
file(GLOB SCINTILLA_LEXERS_CPP "${CMAKE_CURRENT_SOURCE_DIR}/lexers/*.cxx")

# Check if source exists
if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/src/Editor.cxx")
    message(WARNING "Scintilla source not found in ${CMAKE_CURRENT_SOURCE_DIR}. Please run extension/scripts/fetch_scintilla.sh or clone manually.")
    # Create a dummy target to prevent CMake failure if source missing
    add_library(scintilla INTERFACE)
    return()
endif()

set(SCINTILLA_PLATFORM_HEADERS)
set(SCINTILLA_PLATFORM_SOURCES)

if(APPLE)
    file(GLOB SCINTILLA_COCOA_H "${CMAKE_CURRENT_SOURCE_DIR}/cocoa/*.h")
    file(GLOB SCINTILLA_COCOA_MM "${CMAKE_CURRENT_SOURCE_DIR}/cocoa/*.mm")
    list(APPEND SCINTILLA_PLATFORM_HEADERS ${SCINTILLA_COCOA_H})
    list(APPEND SCINTILLA_PLATFORM_SOURCES ${SCINTILLA_COCOA_MM})
elseif(WIN32)
    list(APPEND SCINTILLA_PLATFORM_HEADERS
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/HanjaDic.h"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/ListBox.h"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/PlatWin.h"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/ScintillaWin.h"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/SurfaceD2D.h"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/SurfaceGDI.h"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/WinTypes.h"
    )
    list(APPEND SCINTILLA_PLATFORM_SOURCES
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/HanjaDic.cxx"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/PlatWin.cxx"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/ListBox.cxx"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/SurfaceGDI.cxx"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/SurfaceD2D.cxx"
        "${CMAKE_CURRENT_SOURCE_DIR}/win32/ScintillaWin.cxx"
    )
else()
    message(FATAL_ERROR "Scintilla native view backend only supports macOS and Windows")
endif()

add_library(scintilla STATIC
    ${SCINTILLA_INCLUDE}
    ${SCINTILLA_SRC_H}
    ${SCINTILLA_LEXLIB_H}
    ${SCINTILLA_PLATFORM_HEADERS}
    ${SCINTILLA_SRC_CPP}
    ${SCINTILLA_CALL_CPP}
    ${SCINTILLA_LEXLIB_CPP}
    ${SCINTILLA_LEXERS_CPP}
    ${SCINTILLA_PLATFORM_SOURCES}
)

target_include_directories(scintilla PUBLIC
    "${CMAKE_CURRENT_SOURCE_DIR}/include"
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
    "${CMAKE_CURRENT_SOURCE_DIR}/call"
    "${CMAKE_CURRENT_SOURCE_DIR}/lexlib"
)

if(APPLE)
    target_include_directories(scintilla PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/cocoa")
elseif(WIN32)
    target_include_directories(scintilla PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/win32")
endif()

# Compile definitions needed for Scintilla
    target_compile_definitions(scintilla PRIVATE
    SCI_NAMESPACE
)

if(APPLE)
    target_compile_options(scintilla PRIVATE -fobjc-arc)
    find_library(COCOA_FRAMEWORK Cocoa)
    find_library(QUARTZ_FRAMEWORK QuartzCore)
    target_link_libraries(scintilla PUBLIC ${COCOA_FRAMEWORK} ${QUARTZ_FRAMEWORK})
    
    set_target_properties(scintilla PROPERTIES
        CXX_STANDARD 17
        CXX_STANDARD_REQUIRED ON
        OUTPUT_NAME "scintilla"
    )
elseif(WIN32)
    target_compile_definitions(scintilla PRIVATE
        WIN32_LEAN_AND_MEAN
        NOMINMAX
        UNICODE
        _UNICODE
        _CRT_SECURE_NO_WARNINGS
    )
    target_compile_options(scintilla PRIVATE /EHsc /bigobj /utf-8)
    target_link_libraries(scintilla PUBLIC
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
    set_target_properties(scintilla PROPERTIES
        CXX_STANDARD 17
        CXX_STANDARD_REQUIRED ON
        OUTPUT_NAME "scintilla"
    )
endif()
