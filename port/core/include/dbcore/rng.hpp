// dbcore/rng.hpp — RNG determinista del port (salvaguarda 4 de PLAN.md).
// LCG de VB6: Q02 (OPEN_QUESTIONS.md, fuente externa MS: dotnet/runtime VBMath.vb);
// casos dorados R-01. gasdev: Common.bas:82-100, casos R-02/R-03.
#pragma once

#include <bit>
#include <cstdint>
#include <stdexcept>
#include <vector>

#include "vb.hpp"

namespace db {

// Fuente de rndy() (Common.bas:228-254 con UseIntRnd=False: rndy = Rnd a secas).
// Los subsistemas consumen por esta interfaz para que los casos dorados puedan
// inyectar secuencias (70-CASOS-DORADOS.md §0.6).
struct RndSource {
  virtual ~RndSource() = default;
  virtual vb_single operator()() = 0;  // rndy
};

// El LCG del runtime VB6 (R-01): estado de 24 bits, seed0 = &H50000.
class VbRng final : public RndSource {
 public:
  static constexpr std::uint32_t kSeed0 = 0x50000;

  // Rnd() / Rnd(n>0): avanza y devuelve CSng(seed)/2^24.
  vb_single operator()() override {
    seed_ = (seed_ * 0x43FD43FDu + 0xC39EC3u) & 0xFFFFFFu;
    return static_cast<vb_single>(seed_) / 16777216.0f;
  }

  // Rnd(0): el último valor, sin avanzar.
  vb_single rnd0() const { return static_cast<vb_single>(seed_) / 16777216.0f; }

  // Rnd(n<0): re-siembra desde los bits del Single y avanza una vez (Q02).
  vb_single rnd_negative(vb_single n) {
    const auto b = std::bit_cast<std::int32_t>(n);
    seed_ = static_cast<std::uint32_t>(b + (b >> 24)) & 0xFFFFFFu;
    return (*this)();
  }

  // Randomize n: reemplaza solo los bytes medios del estado; el byte bajo
  // sobrevive (Q02; caso dorado R-01: fresh + Randomize 12.34 => 0xEE3C00).
  void randomize(vb_double n) {
    const auto bits64 = std::bit_cast<std::int64_t>(n);
    const auto hi = static_cast<std::int32_t>(bits64 >> 32);  // palabra alta
    const std::uint32_t mix =
        ((static_cast<std::uint32_t>(hi) & 0xFFFFu) ^
         static_cast<std::uint32_t>(hi >> 16))
        << 8;
    seed_ = (seed_ & 0xFF0000FFu) | (mix & 0x00FFFF00u);
  }

  std::uint32_t state() const { return seed_; }
  void set_state(std::uint32_t s) { seed_ = s & 0xFFFFFFu; }

 private:
  std::uint32_t seed_ = kSeed0;
};

// Secuencia inyectada para tests (§0.6: "rndy -> [v1, v2, ...]").
class InjectedRnd final : public RndSource {
 public:
  explicit InjectedRnd(std::vector<vb_single> values)
      : values_(std::move(values)) {}

  vb_single operator()() override {
    if (next_ >= values_.size())
      throw std::runtime_error("InjectedRnd: secuencia agotada");
    return values_[next_++];
  }

  std::size_t consumed() const { return next_; }
  bool exhausted() const { return next_ == values_.size(); }

 private:
  std::vector<vb_single> values_;
  std::size_t next_ = 0;
};

// gasdev (Common.bas:82-100): Box-Muller polar con caché Static iset/gset.
// Estado global del motor que un save NO persiste (10-CICLO.md §10, R-02).
class Gasdev {
 public:
  vb_single next(RndSource& rndy) {
    if (iset_ == 0) {
      vb_single v1, v2, rsq;
      do {
        v1 = static_cast<vb_single>(2.0 * rndy() - 1.0);
        v2 = static_cast<vb_single>(2.0 * rndy() - 1.0);
        rsq = v1 * v1 + v2 * v2;
      } while (rsq >= 1.0f || rsq == 0.0f);
      const vb_single fac = static_cast<vb_single>(
          std::sqrt(-2.0 * std::log(static_cast<double>(rsq)) /
                    static_cast<double>(rsq)));
      gset_ = v1 * fac;
      iset_ = 1;
      return v2 * fac;
    }
    iset_ = 0;
    return gset_;
  }

 private:
  int iset_ = 0;        // Static iset As Integer
  vb_single gset_ = 0;  // Static gset As Single
};

}  // namespace db
