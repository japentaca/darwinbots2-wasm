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

# Build WASM (M9, decision Q07): emcc compila con excepciones desactivadas por
# defecto, pero el core las usa (InjectedRnd agotada, doctest). Se activan
# explicitamente; el resto de salvaguardas ya aplican (emcc es Clang).
if(EMSCRIPTEN)
  add_compile_options(-fexceptions)
  add_link_options(-fexceptions)
endif()

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
  tests/test_bugs.cpp
  tests/test_bugs2.cpp
  tests/test_bugs3.cpp
  tests/test_mutations.cpp
  tests/test_world.cpp
  tests/test_dynamiccosts.cpp
)
target_link_libraries(dbtests PRIVATE dbcore)
target_include_directories(dbtests PRIVATE tests)

add_test(NAME golden COMMAND dbtests)

# Runtime estatico en MinGW: el exe corre sin las DLL de MSYS2 en el PATH.
if(MINGW)
  target_link_options(dbtests PRIVATE -static)
endif()

if(EMSCRIPTEN)
  # La suite entera corre bajo node: pila holgada (Sim en pila del harness),
  # memoria elastica y codigo de salida real (EXIT_RUNTIME) para CTest/CI.
  target_link_options(dbtests PRIVATE
    -sALLOW_MEMORY_GROWTH=1
    -sSTACK_SIZE=8388608
    -sEXIT_RUNTIME=1
  )

  # Semilla de M10: el core como biblioteca WASM con exports minimos
  # (crear sim, sembrar, tick, volcado de estado). MODULARIZE produce
  # dbcore.js + dbcore.wasm consumibles desde la capa de presentacion.
  add_executable(dbcore_wasm wasm/dbcore_api.cpp)
  set_target_properties(dbcore_wasm PROPERTIES OUTPUT_NAME dbcore)
  target_link_libraries(dbcore_wasm PRIVATE dbcore)
  target_link_options(dbcore_wasm PRIVATE
    --no-entry
    -sMODULARIZE=1
    -sEXPORT_NAME=createDbCore
    -sALLOW_MEMORY_GROWTH=1
    -sSTACK_SIZE=8388608
    -sEXPORTED_FUNCTIONS=_malloc,_free
    -sEXPORTED_RUNTIME_METHODS=cwrap,ccall,HEAPF32,HEAP32,HEAPU8,UTF8ToString,stringToNewUTF8
  )
endif()
