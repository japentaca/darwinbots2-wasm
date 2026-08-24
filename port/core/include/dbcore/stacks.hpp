// dbcore/stacks.hpp — los stacks de la VM (Module1.bas:143-292).
// Contrato completo en 20-VM.md §3 y casos N-16/N-17: los stacks nunca fallan.
#pragma once

#include <array>

#include "vb.hpp"

namespace db {

// Booleanos VB6: True = -1, False = 0. PopBoolStack sobre vacío devuelve el
// centinela -5 ("vacío es true", Module1.bas:282-292).
inline constexpr int VB_TRUE = -1;
inline constexpr int VB_FALSE = 0;
inline constexpr int BOOL_EMPTY = -5;

// IntStack: val(0..100), pos apunta al primer hueco libre.
class IntStack {
 public:
  // Module1.bas:143-156 — con pos >= 101 desplaza y descarta el fondo (N-17).
  void push(vb_long value) {
    if (pos_ >= 101) {
      for (int a = 0; a <= 99; ++a) val_[a] = val_[a + 1];
      val_[100] = 0;
      pos_ = 100;
    }
    val_[pos_] = value;
    pos_ += 1;
  }

  // Module1.bas:158-167 — pop sobre vacío devuelve 0 (y borra val(0)).
  vb_long pop() {
    pos_ -= 1;
    if (pos_ == -1) {
      pos_ = 0;
      val_[0] = 0;
    }
    return val_[pos_];
  }

  // Module1.bas:169-172
  void clear() {
    pos_ = 0;
    val_[0] = 0;
  }

  // Module1.bas:187-199 — swapint: con <=1 elementos, no-op.
  void swap() {
    if (pos_ <= 1) return;
    const vb_long a = pop();
    const vb_long b = pop();
    push(a);
    push(b);
  }

  // Module1.bas:200-217 — overint: a b -> a b a; vacío no-op; 1 elemento
  // apila 0 encima (N-16).
  void over() {
    if (pos_ == 0) return;
    if (pos_ == 1) {
      push(0);
      return;
    }
    const vb_long b = pop();
    const vb_long a = pop();
    push(a);
    push(b);
    push(a);
  }

  int size() const { return pos_; }

 private:
  std::array<vb_long, 102> val_{};  // val(0..100) + margen del pos==101
  int pos_ = 0;
};

// Condst: el stack booleano. Almacena -1/0; pop sobre vacío = -5.
class BoolStack {
 public:
  // Module1.bas:219-232 — ByVal As Boolean: cualquier valor coerciona a -1/0.
  void push(bool value) {
    if (pos_ >= 101) {
      for (int a = 0; a <= 99; ++a) val_[a] = val_[a + 1];
      val_[100] = 0;
      pos_ = 100;
    }
    val_[pos_] = value ? VB_TRUE : VB_FALSE;
    pos_ += 1;
  }

  // Module1.bas:282-292 — devuelve Integer: -1, 0, o el centinela -5.
  int pop() {
    pos_ -= 1;
    if (pos_ == -1) {
      pos_ = 0;
      return BOOL_EMPTY;
    }
    return val_[pos_];
  }

  // Module1.bas:234-238
  void clear() {
    pos_ = 0;
    val_[0] = 0;
  }

  // Module1.bas:239-249 — dupbool sobre vacío es NO-OP (asimétrico con el
  // dup de la VM, que apila dos ceros: N-16).
  void dup() {
    if (pos_ == 0) return;
    const bool a = pop() != 0;  // coerción a Boolean del original
    push(a);
    push(a);
  }

  // Module1.bas:251-263
  void swap() {
    if (pos_ <= 1) return;
    const bool a = pop() != 0;
    const bool b = pop() != 0;
    push(a);
    push(b);
  }

  // Module1.bas:264-280 — 1 elemento: apila True (N-16).
  void over() {
    if (pos_ == 0) return;
    if (pos_ == 1) {
      push(true);
      return;
    }
    const bool b = pop() != 0;
    const bool a = pop() != 0;
    push(a);
    push(b);
    push(a);
  }

  int size() const { return pos_; }

 private:
  std::array<int, 102> val_{};
  int pos_ = 0;
};

}  // namespace db
