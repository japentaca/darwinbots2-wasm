cmake_minimum_required(VERSION 3.20)
project(darwinbots-port CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Salvaguardas numericas de PLAN.md:
#  - prohibido -ffast-math y variantes (salvaguarda 2)
#  - sin contraccion FMA implicita (decision Q07: IEEE 754 estricto por operacion)
#  - -fwrapv SOLO como red (salvaguarda 1: la aritmetica sensible pasa por helpers)
add_compile_options(
  $<$<CXX_COMPILER_ID:GNU,Clang>:-fno-fast-math>
  $<$<CXX_COMPILER_ID:GNU,Clang>:-ffp-contract=off>
  $<$<CXX_COMPILER_ID:GNU,Clang>:-fwrapv>
  $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall>
  $<$<CXX_COMPILER_ID:GNU,Clang>:-Wextra>
)

add_library(dbcore INTERFACE)
target_include_directories(dbcore INTERFACE ${CMAKE_CURRENT_SOURCE_DIR}/core/include)

enable_testing()

add_executable(dbtests
  tests/main.cpp
  tests/test_rng.cpp
  tests/test_authors_suite.cpp
  tests/test_numeric.cpp
  tests/test_vm.cpp
  tests/test_memory.cpp
  tests/test_physics.cpp
  tests/test_formats.cpp
)
target_link_libraries(dbtests PRIVATE dbcore)
target_include_directories(dbtests PRIVATE tests)

add_test(NAME golden COMMAND dbtests)

# Runtime estatico en MinGW: el exe corre sin las DLL de MSYS2 en el PATH.
if(MINGW)
  target_link_options(dbtests PRIVATE -static)
endif()
