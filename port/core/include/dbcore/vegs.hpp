// dbcore/vegs.hpp — economía vegetal (Vegs.bas, 50-MUNDO.md §2): el sol en
// banda móvil (feedvegs, paso 21 del tick) y la digestión de waste
// (feedveg2, P5 vía HandleWaste). La repoblación (VegsRepopulate +
// aggiungirob) vive en master.hpp porque necesita RobScriptLoad.
//
// Notas de transcripción:
//  - feedvegs consume 2 RNG/ciclo con SunOnRnd (Int(Rndy*2000) ×2) y un
//    tercero condicional si la segunda moneda 1/2000 acierta (Int(Rndy*3)).
//  - El decremento de Chlr_Share_Delay vive AQUÍ (Vegs.bas:219-221), dentro
//    del bucle de alimentación de feedvegs (la nota de M7 en robots.hpp lo
//    situaba en feedveg2; el fuente manda).
//  - El original lee TmpOpts.Tides (la copia temporal de la UI) en vez de
//    SimOpts.Tides (Vegs.bas:246). En el port no hay TmpOpts: se lee
//    sim.opts.Tides (equivalen salvo con el diálogo de opciones abierto).
//  - mem(218) queda en 0 para el bot CON cloroplastos fuera de la banda (el
//    GoTo nextrob salta la publicación); el bot sin cloroplastos ve 1.
//  - El impuesto por edad y las mareas se aplican también fuera de la banda
//    (acttok arranca en 0 y se vuelve negativo).
#pragma once

#include <cctype>
#include <cmath>

#include "common.hpp"
#include "sim.hpp"

namespace db {

// SimOptions.bas:41-43 — modos de umbral solar.
inline constexpr vb_integer TEMPSUNSUSPEND = 0;
inline constexpr vb_integer PERMSUNSUSPEND = 1;
inline constexpr vb_integer ADVANCESUN = 2;

// Vegs.bas:41-271 — feedvegs(totnrg): deriva del sol, decisión día/noche,
// luz disponible y alimentación por cloroplastos.
inline void feedvegs(Sim& sim, vb_long totnrg) {
  // Deriva del sol (solo SunOnRnd): SunChange = posición + rango*10 en un
  // byte. 2 RNG fijos + 1 condicional (Vegs.bas:44-65).
  if (sim.opts.SunOnRnd) {
    unsigned char Sposition = static_cast<unsigned char>(sim.SunChange % 10);
    unsigned char Srange = static_cast<unsigned char>(sim.SunChange / 10);

    if (static_cast<vb_long>(std::floor(sim.rnd() * 2000.0f)) == 0)
      Srange = (Srange == 0) ? 1 : 0;
    if (static_cast<vb_long>(std::floor(sim.rnd() * 2000.0f)) == 0)
      Sposition =
          static_cast<unsigned char>(std::floor(sim.rnd() * 3.0f));

    if (Srange == 1) sim.SunRange = sim.SunRange + 0.0005;
    if (Srange == 0) sim.SunRange = sim.SunRange - 0.0005;
    if (sim.SunRange >= 1) Srange = 0;
    if (sim.SunRange <= 0) Srange = 1;

    if (Sposition == 0) sim.SunPosition = sim.SunPosition - 0.0005;
    if (Sposition == 2) sim.SunPosition = sim.SunPosition + 0.0005;
    if (sim.SunPosition >= 1) Sposition = 0;
    if (sim.SunPosition <= 0) Sposition = 2;

    sim.SunChange = static_cast<unsigned char>(Sposition + Srange * 10);
  }

  bool FeedThisCycle = sim.opts.Daytime;
  bool OverrideDayNight = false;

  // Umbrales de energía total (Vegs.bas:85-133).
  if (sim.TotalSimEnergyDisplayed < sim.opts.SunUpThreshold &&
      sim.opts.SunUp) {
    switch (sim.opts.SunThresholdMode) {
      case TEMPSUNSUSPEND:
        FeedThisCycle = true;
        OverrideDayNight = true;
        break;
      case ADVANCESUN:
        sim.opts.DayNightCycleCounter = 0;
        sim.opts.Daytime = true;
        FeedThisCycle = true;
        break;
      case PERMSUNSUSPEND:
        FeedThisCycle = true;
        sim.opts.Daytime = true;
        break;
      default: break;
    }
  } else if (sim.TotalSimEnergyDisplayed > sim.opts.SunDownThreshold &&
             sim.opts.SunDown) {
    switch (sim.opts.SunThresholdMode) {
      case TEMPSUNSUSPEND:
        FeedThisCycle = false;
        OverrideDayNight = true;
        break;
      case ADVANCESUN:
        sim.opts.DayNightCycleCounter = 0;
        sim.opts.Daytime = false;
        FeedThisCycle = false;
        break;
      case PERMSUNSUSPEND:
        FeedThisCycle = false;
        sim.opts.Daytime = false;
        break;
      default: break;
    }
  }

  // PERMSUNSUSPEND con ambos umbrales activos ignora los ciclos día/noche.
  if (sim.opts.SunThresholdMode == PERMSUNSUSPEND && sim.opts.SunDown &&
      sim.opts.SunUp)
    OverrideDayNight = true;

  // Reloj día/noche (Vegs.bas:135-147).
  if (sim.opts.DayNight && !OverrideDayNight) {
    sim.opts.DayNightCycleCounter += 1;
    if (sim.opts.DayNightCycleCounter > sim.opts.CycleLength) {
      sim.opts.Daytime = !sim.opts.Daytime;
      sim.opts.DayNightCycleCounter = 0;
    }
    FeedThisCycle = sim.opts.Daytime;
  }

  // (MDIForm1.SunButton: display ⚙.)

  // Todos los vivos arrancan pensando que no hay sol (Vegs.bas:158-162).
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].nrg > 0.0f && sim.rob[t].exist &&
        !BaseHidden(sim, sim.rob[t]))  // E5 (Vegs.bas:161)
      sim.rob[t].mem[218] = 0;
  }

  if (!FeedThisCycle) return;  // GoTo getout

  // Luz disponible (Vegs.bas:166-186): área de pantalla menos formas, área
  // total de robots. TotalRobotArea acumula en Single; radius^2*PI es Double.
  double ScreenArea = static_cast<double>(sim.opts.FieldWidth) *
                      static_cast<double>(sim.opts.FieldHeight);
  for (int t = 1; t <= sim.numObstacles; ++t) {
    if (sim.Obstacles[t].exist)
      ScreenArea -= sim.Obstacles[t].Width * sim.Obstacles[t].Height;
  }

  vb_single TotalRobotArea = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist && !BaseHidden(sim, sim.rob[t]))  // E5 (:178)
      TotalRobotArea = static_cast<vb_single>(
          TotalRobotArea +
          std::pow(static_cast<double>(sim.rob[t].radius), 2.0) *
              static_cast<double>(PI));
  }

  if (ScreenArea < 1) ScreenArea = 1;

  sim.LightAval = static_cast<double>(TotalRobotArea) / ScreenArea;
  if (sim.LightAval > 1) sim.LightAval = 1;

  const vb_single AreaCorrection = static_cast<vb_single>(
      std::pow(1.0 - sim.LightAval, 2.0) * 4.0);

  // Banda solar con envoltura (Vegs.bas:190-210). sunstart/sunstop son Long:
  // la asignación redondea bancario.
  vb_long sunstart = static_cast<vb_long>(vb_round64(
      (sim.SunPosition -
       (0.25 + std::pow(sim.SunRange, 3.0) * 0.75) / 2.0) *
      static_cast<double>(sim.opts.FieldWidth)));
  vb_long sunstop = static_cast<vb_long>(vb_round64(
      (sim.SunPosition +
       (0.25 + std::pow(sim.SunRange, 3.0) * 0.75) / 2.0) *
      static_cast<double>(sim.opts.FieldWidth)));

  vb_long sunstop2 = sunstop;
  vb_long sunstart2 = sunstart;  // "Do not delete, bug fix!"

  if (sunstart < 0) {
    sunstart2 = static_cast<vb_long>(sim.opts.FieldWidth) + sunstart;
    sunstop2 = static_cast<vb_long>(sim.opts.FieldWidth);
  }
  if (sunstop > static_cast<vb_long>(sim.opts.FieldWidth)) {
    sunstop2 = sunstop - static_cast<vb_long>(sim.opts.FieldWidth);
    sunstart2 = 0;
  }

  // Alimentación por bot (Vegs.bas:212-269).
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    Bot& b = sim.rob[t];
    if (!(b.nrg > 0.0f && b.exist && !BaseHidden(sim, b)))  // E5 (:215)
      continue;

    vb_single acttok = 0;

    if (b.chloroplasts > 0.0f) {
      if (b.Chlr_Share_Delay > 0) b.Chlr_Share_Delay -= 1;

      acttok = 0;

      // Fuera de banda: GoTo nextrob (salta la publicación de mem(218)).
      if (((b.pos.x < static_cast<vb_single>(sunstart2) ||
            b.pos.x > static_cast<vb_single>(sunstop2)) &&
           (b.pos.x < static_cast<vb_single>(sunstart) ||
            b.pos.x > static_cast<vb_single>(sunstop))))
        goto nextrob;

      {
        vb_single tok;
        if (sim.opts.Pondmode) {
          // depth es Long: (pos.y/2000 + 1) redondea bancario.
          vb_long depth = static_cast<vb_long>(vb_round64(
              static_cast<double>(b.pos.y) / 2000.0 + 1.0));
          if (depth < 1) depth = 1;
          tok = static_cast<vb_single>(
              static_cast<double>(sim.opts.LightIntensity) /
              std::pow(static_cast<double>(depth),
                       static_cast<double>(sim.opts.Gradient)));
        } else {
          tok = static_cast<vb_single>(totnrg);
        }

        if (tok < 0.0f) tok = 0.0f;

        tok = static_cast<vb_single>(static_cast<double>(tok) / 3.5);

        const vb_single ChloroplastCorrection = static_cast<vb_single>(
            static_cast<double>(b.chloroplasts) / 16000.0);
        const vb_single AddEnergyRate = static_cast<vb_single>(
            static_cast<double>(AreaCorrection * ChloroplastCorrection) *
            1.25);
        const vb_single SubtractEnergyRate = static_cast<vb_single>(std::pow(
            static_cast<double>(b.chloroplasts) / 32000.0, 2.0));

        acttok = (AddEnergyRate - SubtractEnergyRate) * tok;
      }
    }
    b.mem[218] = 1;  // "Now it is time view the sun"

  nextrob:
    if (b.chloroplasts > 0.0f) {
      // Impuesto por edad (Vegs.bas:242): Single*Single/1e9 es Double.
      acttok = static_cast<vb_single>(
          static_cast<double>(acttok) -
          static_cast<double>(static_cast<vb_single>(b.age) *
                              b.chloroplasts) /
              1000000000.0);

      // El original lee TmpOpts.Tides (quirk de UI; ver cabecera).
      if (sim.opts.Tides > 0)
        acttok = acttok * (1.0f - sim.BouyancyScaling);

      b.nrg = b.nrg + acttok * (1.0f - sim.opts.VegFeedingToBody);
      b.body = static_cast<vb_single>(
          static_cast<double>(b.body) +
          static_cast<double>(acttok * sim.opts.VegFeedingToBody) / 10.0);

      if (b.nrg > 32000.0f) b.nrg = 32000.0f;
      if (b.body > 32000.0f) b.body = 32000.0f;
      b.radius = FindRadius(sim, t);
    }
  }
}

// Vegs.bas:273-325 — feedveg2: digestión de waste con cloroplastos. 1 RNG
// decide el orden nrg-primero / body-primero; la segunda conversión ve el
// waste ya reducido.
inline void feedveg2(Sim& sim, int t) {
  Bot& b = sim.rob[t];

  const vb_single Energy = static_cast<vb_single>(
      static_cast<double>(b.chloroplasts) / 64000.0 *
      static_cast<double>(1.0f - sim.opts.VegFeedingToBody));
  const vb_single body = static_cast<vb_single>(
      static_cast<double>(b.chloroplasts) / 64000.0 *
      static_cast<double>(sim.opts.VegFeedingToBody) / 10.0);

  const auto nrg_half = [&]() {
    if (b.Waste > 0.0f) {
      if (b.nrg + Energy < 32000.0f) {
        b.nrg = b.nrg + Energy;
        b.Waste = static_cast<vb_single>(
            static_cast<double>(b.Waste) -
            static_cast<double>(b.chloroplasts) / 32000.0 *
                static_cast<double>(1.0f - sim.opts.VegFeedingToBody));
      }
      if (b.Waste < 0.0f) b.Waste = 0.0f;
    }
  };
  const auto body_half = [&]() {
    if (b.Waste > 0.0f) {
      if (b.body + body < 32000.0f) {
        b.body = b.body + body;
        b.Waste = static_cast<vb_single>(
            static_cast<double>(b.Waste) -
            static_cast<double>(b.chloroplasts) / 32000.0 *
                static_cast<double>(sim.opts.VegFeedingToBody));
      }
      if (b.Waste < 0.0f) b.Waste = 0.0f;
    }
  };

  if (static_cast<vb_long>(std::floor(sim.rnd() * 2.0f)) == 0) {
    nrg_half();   // energy first
    body_half();
  } else {
    body_half();  // body first
    nrg_half();
  }
}

// Globals.bas:333-391 — checkvegstatus(r): ¿la especie r es elegible para
// repoblar? Debe ser vegetal y nativa; elegible si algún bot vivo CON
// cloroplastos lleva su nombre (quitando el prefijo de subespecie "(n)"), o
// si no queda ningún vegetal vivo con age > 0 en todo el campo.
inline bool checkvegstatus(Sim& sim, int r) {
  if (r < 0 || static_cast<std::size_t>(r) >= sim.Specie.size()) return false;
  const Specie& sp = sim.Specie[static_cast<std::size_t>(r)];

  if (!(sp.Veg && sp.Native)) return false;

  for (int t = 1; t <= sim.MaxRobs; ++t) {
    const Bot& b = sim.rob[t];
    if (b.exist && b.chloroplasts > 0.0f) {
      // Split(FName, ")"): si el primer tramo es "(numérico", el nombre real
      // es lo que sigue al ")" (nick de subespecie).
      std::string robname = b.FName;
      const std::size_t close = b.FName.find(')');
      if (close != std::string::npos) {
        const std::string first = b.FName.substr(0, close);
        if (!first.empty() && first[0] == '(') {
          const std::string num = first.substr(1);
          bool isnum = !num.empty();
          for (char c : num)
            if (!(std::isdigit(static_cast<unsigned char>(c)) || c == '-' ||
                  c == '+' || c == '.'))
              isnum = false;
          if (isnum) robname = b.FName.substr(close + 1);
        }
      }
      if (sp.Name == robname) return true;
    }
  }

  // Sin ningún bot con cloroplastos: repoblar todo… salvo que quede algún
  // vegetal vivo con age > 0 (los age = 0 aún no "arrancaron").
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    const Bot& b = sim.rob[t];
    if (b.exist && b.Veg && b.age > 0) return false;
  }
  return true;
}

}  // namespace db
