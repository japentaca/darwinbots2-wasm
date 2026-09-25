// dbcore/ties.hpp — Ties.bas: maketie/DeleteTie, tieportcom, Update_Ties
// (compartición y comandos de tie), readtie/ReadTRefVars/EraseTRefVars,
// UpdateTieAngles, y la porción de TieHooke que gobierna el tiempo de vida
// (countdown/endurecimiento). Las fuerzas de muelle son del milestone de
// física (B4/F-*) y quedan como stub documentado.
// Contratos: 21-MEMORIA.md §3-§4, 34-TIES.md; casos M-04, M-05, M-07, M-11.
#pragma once

#include "senses.hpp"
#include "sim.hpp"

namespace db {

// Ties.bas:962-976 — srctie: tie de t que apunta a p (solo endurecidas o
// recién creadas: last < 1).
inline int srctie(Sim& sim, int t, int p) {
  int j = 1;
  int found = 0;
  Bot& b = sim.rob[t];
  while (j <= MAXTIES && b.Ties[j].pnt > 0 && found == 0) {
    if (b.Ties[j].pnt == p && b.Ties[j].last < 1) found = j;
    j += 1;
  }
  return found;
}

// Ties.bas:832-889 — DeleteTie.
inline void DeleteTie(Sim& sim, int a, int b) {
  if (!sim.rob[a].exist || !sim.rob[b].exist) return;
  if (sim.rob[a].numties == 0.0f || sim.rob[b].numties == 0.0f) return;

  int k = 1, j = 1;
  while (sim.rob[a].Ties[k].pnt != b && k < MAXTIES) k += 1;
  while (sim.rob[b].Ties[j].pnt != a && j < MAXTIES) j += 1;

  if (k < MAXTIES) {
    sim.rob[a].numties -= 1;
    sim.rob[a].mem[addr::numties] = vb_cint(sim.rob[a].numties);
    if (sim.rob[a].mem[addr::TIEPRES] == sim.rob[a].Ties[k].Port)
      sim.rob[a].mem[addr::TIEPRES] = (k > 1) ? sim.rob[a].Ties[k - 1].Port : 0;
  }
  if (j < MAXTIES) {
    sim.rob[b].numties -= 1;
    sim.rob[b].mem[addr::numties] = vb_cint(sim.rob[b].numties);
    if (sim.rob[b].mem[addr::TIEPRES] == sim.rob[b].Ties[j].Port)
      sim.rob[b].mem[addr::TIEPRES] = (j > 1) ? sim.rob[b].Ties[j - 1].Port : 0;
  }
  for (int t = k; t <= MAXTIES - 1; ++t)
    sim.rob[a].Ties[t] = sim.rob[a].Ties[t + 1];
  sim.rob[a].Ties[MAXTIES].pnt = 0;
  for (int t = j; t <= MAXTIES - 1; ++t)
    sim.rob[b].Ties[t] = sim.rob[b].Ties[t + 1];
  sim.rob[b].Ties[MAXTIES].pnt = 0;
}

// Ties.bas:822-829 — delallties.
inline void delallties(Sim& sim, int a) {
  int i = 1;
  while (sim.rob[a].Ties[1].pnt != 0 && i <= MAXTIES) {
    DeleteTie(sim, a, sim.rob[a].Ties[1].pnt);
    i += 1;
  }
}

// Ties.bas:721-806 — ReadTRefVars: trefvars de la tie k en la memoria de t.
// [PROBABLE BUG] A3-3: trefnrg no se actualiza con nrg = ±32000 exactos.
// [PROBABLE BUG] A3-4: el chequeo de espionaje mira mem(479) (trefaim) en vez
// de mem(476) (tmemloc). Sin fudge (evo ⚙).
inline void ReadTRefVars(Sim& sim, int t, int k) {
  Bot& b = sim.rob[t];
  Bot& o = sim.rob[b.Ties[k].pnt];

  if (o.nrg < 32000.0f && o.nrg > -32000.0f)
    b.mem[464] = vb_cint(o.nrg);  // guarda estricta: ±32000 exactos congelan
  if (o.age < 32000)
    b.mem[465] = static_cast<vb_integer>(o.age + 1);
  else
    b.mem[465] = 32000;
  if (o.body < 32000.0f && o.body > -32000.0f)
    b.mem[addr::trefbody] = vb_cint(o.body);
  else
    b.mem[addr::trefbody] = 32000;

  for (int l = 1; l <= 8; ++l) b.mem[455 + l] = o.occurr[l];

  if (b.mem[476] > 0 && b.mem[476] <= 1000) {  // tmemloc/tmemval
    b.mem[475] = o.mem[b.mem[476]];
    if (b.mem[479] > addr::EyeStart && b.mem[479] < addr::EyeEnd)
      o.View = true;  // [PROBABLE BUG] A3-4: celda equivocada (Ties.bas:756-758)
  }
  b.mem[478] = o.Fixed ? 1 : 0;
  b.mem[479] = o.mem[addr::AimSys];

  b.mem[addr::trefxpos] = o.mem[219];
  b.mem[addr::trefypos] = o.mem[217];
  b.mem[addr::trefvelyourup] = o.mem[addr::velup];
  b.mem[addr::trefvelyourdn] = o.mem[addr::veldn];
  b.mem[addr::trefvelyoursx] = o.mem[addr::velsx];
  b.mem[addr::trefvelyourdx] = o.mem[addr::veldx];

  // Efecto colateral del fuente: leer clampa la velocidad física del atado
  // (Ties.bas:776-777).
  if (std::fabs(o.vel.y) > 16000.0f)
    o.vel.y = 16000.0f * static_cast<vb_single>(vb_sgn(o.vel.y));
  if (std::fabs(o.vel.x) > 16000.0f)
    o.vel.x = 16000.0f * static_cast<vb_single>(vb_sgn(o.vel.x));

  const double ca = std::cos(static_cast<double>(b.aim));
  const double sa = std::sin(static_cast<double>(b.aim));
  b.mem[addr::trefvelmyup] = vb_cint(
      static_cast<double>(o.vel.x) * ca + sa * o.vel.y * -1.0 -
      b.mem[addr::velup]);
  b.mem[addr::trefvelmydn] =
      static_cast<vb_integer>(-b.mem[addr::trefvelmyup]);
  b.mem[addr::trefvelmydx] = vb_cint(
      static_cast<double>(o.vel.y) * ca + sa * o.vel.x - b.mem[addr::veldx]);
  b.mem[addr::trefvelmysx] =
      static_cast<vb_integer>(-b.mem[addr::trefvelmydx]);
  b.mem[addr::trefvelscalar] = o.mem[addr::velscalar];
  b.mem[addr::trefshell] = vb_cint(o.shell);

  for (int l = 410; l <= 419; ++l) b.mem[l + 10] = o.mem[l];  // tout->tin
}

// Ties.bas:655-677 — EraseTRefVars. [PROBABLE BUG] A3-2 (M-07): la lista de
// borrado SALTA la 449 (trefshell); tmemloc (476) persiste adrede.
inline void EraseTRefVars(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  for (int counter = 456; counter <= 465; ++counter) b.mem[counter] = 0;
  b.mem[addr::trefbody] = 0;  // 437
  b.mem[475] = 0;             // tmemval
  b.mem[478] = 0;             // treffixed
  b.mem[479] = 0;             // trefaim
  for (int counter = 0; counter <= 10; ++counter)
    b.mem[addr::trefxpos + counter] = 0;  // 438..448
  for (int counter = 420; counter <= 429; ++counter) b.mem[counter] = 0;  // tin
}

// Ties.bas:894-959 — maketie. Consume 1 RNG (deflect = Random(2,92), Q01).
inline bool maketie(Sim& sim, int a, int b, vb_long c, vb_integer last,
                    vb_integer mem) {
  if (!sim.rob[a].exist) return false;

  const vb_long deflect = Random(2, 92, *sim.rndy);
  const int Max = MAXTIES;
  bool OK = true;
  int k = 1, j = 1;

  // Dim Length As Long: la distancia se redondea (CLng) y la NaturalLength
  // de la tie nueva es entera (RV-18).
  Vector diff = VectorSub(sim.rob[a].pos, sim.rob[b].pos);
  const vb_long Length = vb_clng(VectorMagnitude(diff));
  bool made = false;

  if (static_cast<double>(Length) <= static_cast<double>(c) * 1.5) {
    if (static_cast<vb_single>(deflect) < sim.rob[b].Slime) OK = false;
    if (OK) DeleteTie(sim, a, b);

    while (k <= Max && sim.rob[a].Ties[k].pnt > 0 && OK) k += 1;
    while (j <= Max && sim.rob[b].Ties[j].pnt > 0 && OK) j += 1;

    if (k < Max && j < Max && OK) {
      Tie& ta = sim.rob[a].Ties[k];
      ta.pnt = static_cast<vb_integer>(b);
      ta.ptt = static_cast<vb_integer>(j);
      ta.NaturalLength = static_cast<vb_single>(Length);
      ta.stat = false;
      ta.last = last;
      ta.Port = mem;
      ta.back = false;
      sim.rob[a].numties = static_cast<vb_single>(k);
      sim.rob[a].mem[466] = static_cast<vb_integer>(k);
      sim.rob[a].mem[addr::TIEPRES] = mem;
      ReadTRefVars(sim, a, k);
      ta.b = 0.02f;
      ta.k = 0.01f;
      ta.type = 0;

      Tie& tb = sim.rob[b].Ties[j];
      tb.pnt = static_cast<vb_integer>(a);
      tb.ptt = static_cast<vb_integer>(k);
      tb.NaturalLength = static_cast<vb_single>(Length);
      tb.stat = false;
      tb.last = last;
      tb.back = true;
      sim.rob[b].numties = static_cast<vb_single>(j);
      tb.Port = static_cast<vb_integer>(j);
      sim.rob[b].mem[466] = static_cast<vb_integer>(j);
      sim.rob[b].mem[addr::TIEPRES] = static_cast<vb_integer>(j);
      tb.b = 0.02f;
      tb.k = 0.01f;
      tb.type = 0;
      made = true;
    }
  }

  if (sim.rob[b].Slime > 0.0f) sim.rob[b].Slime -= 20.0f;
  if (sim.rob[b].Slime < 0.0f) sim.rob[b].Slime = 0.0f;
  const vb_single nt = sim.rob[a].numties;
  sim.rob[a].nrg -=
      (sim.vm.costs.v[cost::TIECOST] * sim.vm.costs.v[cost::COSTMULTIPLIER]) /
      ((nt < 0.0f ? 0.0f : nt) + 1.0f);
  return made;
}

// Ties.bas:979-1000 — regang: endurece la tie j (multibot).
inline void regang(Sim& sim, int t, int j) {
  Bot& b = sim.rob[t];
  b.Multibot = true;
  b.mem[addr::multi] = 1;
  b.Ties[j].b = 0.1f;
  b.Ties[j].k = 0.05f;
  b.Ties[j].type = 3;
  const int n = b.Ties[j].pnt;
  const vb_single angl =
      vb_angle(b.pos.x, b.pos.y, sim.rob[n].pos.x, sim.rob[n].pos.y);
  const vb_single dist = static_cast<vb_single>(
      std::sqrt(std::pow(static_cast<double>(b.pos.x) - sim.rob[n].pos.x, 2.0) +
                std::pow(static_cast<double>(b.pos.y) - sim.rob[n].pos.y, 2.0)));
  if (!b.Ties[j].back) {
    b.Ties[j].ang = AngDiff(angnorm(angl), angnorm(b.aim));
    b.Ties[j].angreg = true;
  }
  b.Ties[j].NaturalLength = dist;
}

// Physics.bas:558-573 — CheckRobot: True si el bot apuntado NO existe
// (fuera del array o exist = False); CheckRobot(0) = False.
inline bool CheckRobot(Sim& sim, int n) {
  if (n > static_cast<int>(sim.rob.size()) - 1) return true;
  if (n == 0) return false;
  return !sim.rob[n].exist;
}

// Physics.bas:465-555 — TieHooke (P1, gate solo numties = 0): purga de ties
// inválidas, rotura por longitud > 1000, reloj de la tie (countdown a
// destrucción / countup a endurecimiento) y el muelle amortiguado -kx - bv
// con zona muerta de 20 (F-05). Solo actúa sobre el extremo n: las fuerzas
// de una tie se aplican en dos momentos distintos de la pasada.
inline void TieHooke(Sim& sim, int n) {
  if (sim.rob[n].numties == 0.0f) return;

  const vb_single deformation = 20.0f;  // zona muerta
  Bot& b = sim.rob[n];

  int k = 1;
  while (k <= MAXTIES && b.Ties[k].pnt != 0) {
    // Purga in situ de ties a bots inexistentes (Physics.bas:492-510).
    if (CheckRobot(sim, b.Ties[k].pnt)) {
      do {
        if (k > 1)
          b.mem[addr::TIEPRES] = b.Ties[k - 1].Port;
        else
          b.mem[addr::TIEPRES] = 0;
        for (int t = k; t <= MAXTIES - 1; ++t) b.Ties[t] = b.Ties[t + 1];
        b.Ties[MAXTIES].pnt = 0;
      } while (CheckRobot(sim, b.Ties[k].pnt));
    }

    // Nota: tras la purga, Ties(k).pnt puede ser 0 (CheckRobot(0) = False
    // corta el Do): el fuente sigue con rob(0) — se replica.
    Vector uv = VectorSub(b.pos, sim.rob[b.Ties[k].pnt].pos);
    const vb_single Length = VectorMagnitude(uv);

    if (Length - b.radius - sim.rob[b.Ties[k].pnt].radius > 1000.0f) {
      DeleteTie(sim, n, b.Ties[k].pnt);
    } else {
      if (b.Ties[k].last > 1) b.Ties[k].last -= 1;  // countdown a borrado
      if (b.Ties[k].last < 0) b.Ties[k].last += 1;  // countup a endurecer

      if (b.Ties[k].last == 1) {
        DeleteTie(sim, n, b.Ties[k].pnt);
      } else {
        if (b.Ties[k].last == -1) regang(sim, n, k);

        if (Length != 0.0f) {
          uv = VectorScalar(uv, 1.0f / Length);

          // -kx con zona muerta.
          vb_single displacement = b.Ties[k].NaturalLength - Length;
          if (std::fabs(displacement) > deformation) {
            displacement = static_cast<vb_single>(vb_sgn(displacement)) *
                           (std::fabs(displacement) - deformation);
            vb_single Impulse = b.Ties[k].k * displacement;
            b.ImpulseInd = VectorAdd(b.ImpulseInd, VectorScalar(uv, Impulse));

            // -bv.
            Vector vy = VectorSub(b.vel, sim.rob[b.Ties[k].pnt].vel);
            Impulse = Dot(vy, uv) * -b.Ties[k].b;
            b.ImpulseInd = VectorAdd(b.ImpulseInd, VectorScalar(uv, Impulse));
          }
        }
      }
    }
    k += 1;
  }
}

// Physics.bas:651-729 — TieTorque (P1, gate: no corpse, no DisableDNA en el
// llamador): par sobre las ties con ángulo fijado (angreg). [PROBABLE BUG]
// B1-1: el clamp de nay usa Sgn(nax) (F-12). [PROBABLE BUG] B1-2: con
// |mt| > 2*PI escribe Ties(j).ang en el slot SIGUIENTE al último (slot de
// tie vacío; con 10 ties sería Ties(11) — error 9, registrado).
inline void TieTorque(Sim& sim, int t) {
  const vb_single angleslack =
      5.0f * 2.0f * PI / 360.0f;  // 5 grados de holgura

  int j = 1;
  vb_single mt = 0.0f;
  vb_single anl = 0.0f, dlo = 0.0f;
  int n = 0;
  Bot& b = sim.rob[t];

  if (b.numties > 0.0f) {
    if (b.Ties[1].pnt > 0) {
      while (j <= MAXTIES && b.Ties[j].pnt > 0) {
        if (b.Ties[j].angreg) {
          n = b.Ties[j].pnt;
          anl = vb_angle(b.pos.x, b.pos.y, sim.rob[n].pos.x,
                         sim.rob[n].pos.y);
          dlo = AngDiff(anl, b.aim);
          vb_single mm = AngDiff(dlo, b.Ties[j].ang + b.Ties[j].bend);

          b.Ties[j].bend = 0.0f;  // consume .tieang
          if (std::fabs(mm) > angleslack) {
            mm = (std::fabs(mm) - angleslack) *
                 static_cast<vb_single>(vb_sgn(mm));
            // mm * 0.1 y -Sin(anl) * m * dist / 10: literal e intrínseca
            // Double, cadena en Double con un solo redondeo (RV-05).
            const vb_single m =
                static_cast<vb_single>(static_cast<double>(mm) * 0.1);
            const vb_single dx = sim.rob[n].pos.x - b.pos.x;
            const vb_single dy = b.pos.y - sim.rob[n].pos.y;
            const vb_single dist = static_cast<vb_single>(std::sqrt(
                std::pow(static_cast<double>(dx), 2.0) +
                std::pow(static_cast<double>(dy), 2.0)));
            vb_single nax = static_cast<vb_single>(
                -std::sin(static_cast<double>(anl)) * m * dist / 10.0);
            vb_single nay = static_cast<vb_single>(
                -std::cos(static_cast<double>(anl)) * m * dist / 10.0);
            if (std::fabs(nax) > 100.0f)
              nax = 100.0f * static_cast<vb_single>(vb_sgn(nax));
            if (std::fabs(nay) > 100.0f)
              nay = 100.0f * static_cast<vb_single>(
                                 vb_sgn(nax));  // [PROBABLE BUG] B1-1 (F-12)

            const Vector TorqueVector = VectorSet(nax, nay);
            sim.rob[n].ImpulseInd =
                VectorSub(sim.rob[n].ImpulseInd, TorqueVector);
            b.ImpulseInd = VectorAdd(b.ImpulseInd, TorqueVector);
            mt = mt + mm;
          }
        }
        j += 1;
      }

      if (mt != 0.0f) {
        if (std::fabs(mt) > 2.0f * PI) {
          // Escritura en el slot fantasma (j = una posición después de la
          // última tie). Con j > MAXTIES el original indexa Ties(11):
          // error 9 — decisión de port: registrar y no escribir.
          if (j <= MAXTIES)
            b.Ties[j].ang = dlo;
          else
            sim.diag.err9_ties_slot11 += 1;
        } else {
          if (std::fabs(mt) < PI / 4.0f)
            b.ma = mt;
          else
            b.ma = PI / 4.0f * static_cast<vb_single>(vb_sgn(mt));
        }
      }
    }
  }
}

// Ties.bas:48-77 — tieportcom (P1): escritura cruzada de memoria por tie.
inline void tieportcom(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  if (!(b.mem[455] != 0 && b.numties > 0.0f && b.mem[addr::tieloc] > 0)) return;
  const vb_integer tn = b.mem[addr::TIENUM];
  int k = 1;
  if (b.mem[addr::tieloc] > 0 && b.mem[addr::tieloc] < 1001) {
    while (k <= MAXTIES && b.Ties[k].pnt > 0) {
      if (b.Ties[k].Port == tn) {
        sim.rob[b.Ties[k].pnt].mem[b.mem[addr::tieloc]] = b.mem[addr::tieval];
        if (!b.Ties[k].back)
          b.Ties[k].infused = true;
        else
          sim.rob[b.Ties[k].pnt].Ties[b.Ties[k].ptt].infused = true;
        b.mem[addr::tieval] = 0;
        b.mem[addr::tieloc] = 0;
      }
      k += 1;
    }
  }
}

// Ties.bas:79-120 — UpdateTieAngles (P5, corre para TODOS los slots:
// [PROBABLE BUG] A1-6/A3-9, sin efecto observable — Q11).
inline void UpdateTieAngles(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  b.mem[addr::TIEANG] = 0;
  b.mem[addr::TIELEN] = 0;
  if (b.numties <= 0.0f) return;

  vb_integer whichTie;
  if (b.mem[addr::TIENUM] != 0)
    whichTie = b.mem[addr::TIENUM];
  else
    whichTie = b.mem[addr::TIEPRES];
  if (whichTie == 0) return;

  int k = vb_cint(b.numties);
  while (k > 0) {
    if (b.Ties[k].Port == whichTie) {
      const int n = b.Ties[k].pnt;
      const vb_single tieAngle =
          vb_angle(b.pos.x, b.pos.y, sim.rob[n].pos.x, sim.rob[n].pos.y);
      vb_single dist = static_cast<vb_single>(std::sqrt(
          std::pow(static_cast<double>(b.pos.x) - sim.rob[n].pos.x, 2.0) +
          std::pow(static_cast<double>(b.pos.y) - sim.rob[n].pos.y, 2.0)));
      if (dist > 32000.0f) dist = 32000.0f;
      b.mem[addr::TIEANG] =
          static_cast<vb_integer>(-vb_cint(
              AngDiff(angnorm(tieAngle), angnorm(b.aim)) * 200.0f));
      b.mem[addr::TIELEN] =
          vb_cint(dist - b.radius - sim.rob[n].radius);
      return;
    }
    k -= 1;
  }
}

// --- compartición multibot (Robots.bas:1866-2007) — normalización in place
// (M-11): el comando se reescribe normalizado en la celda antes de usarse.

// Robots.bas:1955-2007 — sharenrg: Mod 100 con 0 -> 100 en la celda.
inline void sharenrg(Sim& sim, int t, int k) {
  Bot& b = sim.rob[t];
  Bot& o = sim.rob[b.Ties[k].pnt];
  if (b.nrg < 0.0f || o.nrg < 0.0f) return;

  if (b.mem[830] <= 0) {
    b.mem[830] = 0;
  } else {
    b.mem[830] = static_cast<vb_integer>(b.mem[830] % 100);
    if (b.mem[830] == 0) b.mem[830] = 100;
  }

  const vb_single totnrg = b.nrg + o.nrg;
  // totnrg * (CSng(m) / 100#): Single * Double, un redondeo (RV-20).
  vb_single portionThatsMine = static_cast<vb_single>(
      static_cast<double>(totnrg) * (static_cast<double>(b.mem[830]) / 100.0));
  if (portionThatsMine > 32000.0f) portionThatsMine = 32000.0f;
  vb_single myChangeInNrg = portionThatsMine - b.nrg;
  if (std::fabs(myChangeInNrg) > b.body)
    myChangeInNrg = static_cast<vb_single>(vb_sgn(myChangeInNrg)) * b.body;
  if (b.nrg + myChangeInNrg > 32000.0f) myChangeInNrg = 32000.0f - b.nrg;
  if (b.nrg + myChangeInNrg < 0.0f) myChangeInNrg = -b.nrg;
  if (o.nrg - myChangeInNrg > 32000.0f) myChangeInNrg = -(32000.0f - o.nrg);
  if (o.nrg - myChangeInNrg < 0.0f) myChangeInNrg = o.nrg;

  b.nrg += myChangeInNrg;
  o.nrg -= myChangeInNrg;
  b.nrg = static_cast<vb_single>(static_cast<double>(b.nrg) -
                                 std::fabs(static_cast<double>(myChangeInNrg)) * 0.01);
  if (b.nrg > 32000.0f) b.nrg = 32000.0f;
  if (o.nrg > 32000.0f) o.nrg = 32000.0f;
}

namespace ties_detail {
// `tot * (CSng(m) / 100#)` y `tot * ((100# - CSng(m)) / 100#)`: Single * Double,
// comparado con 32000 en Double y redondeado una vez al asignar (RV-20).
inline vb_single share_part(vb_single tot, double frac) {
  const double v = static_cast<double>(tot) * frac;
  return v < 32000.0 ? static_cast<vb_single>(v) : 32000.0f;
}
inline double pct_mine(vb_integer m) { return static_cast<double>(m) / 100.0; }
inline double pct_theirs(vb_integer m) {
  return (100.0 - static_cast<double>(m)) / 100.0;
}
}  // namespace ties_detail

// Robots.bas:1895-1911 — shareslime: clamp 0..99 en la celda.
inline void shareslime(Sim& sim, int t, int k) {
  Bot& b = sim.rob[t];
  Bot& o = sim.rob[b.Ties[k].pnt];
  if (b.mem[833] > 99) b.mem[833] = 99;
  if (b.mem[833] < 0) b.mem[833] = 0;
  const vb_single totslime = b.Slime + o.Slime;
  b.Slime = ties_detail::share_part(totslime, ties_detail::pct_mine(b.mem[833]));
  o.Slime = ties_detail::share_part(totslime, ties_detail::pct_theirs(b.mem[833]));
}

// Robots.bas:1913-1930 — sharewaste (0..99).
inline void sharewaste(Sim& sim, int t, int k) {
  Bot& b = sim.rob[t];
  Bot& o = sim.rob[b.Ties[k].pnt];
  if (b.mem[831] > 99) b.mem[831] = 99;
  if (b.mem[831] < 0) b.mem[831] = 0;
  const vb_single totwaste = b.Waste + o.Waste;
  b.Waste = ties_detail::share_part(totwaste, ties_detail::pct_mine(b.mem[831]));
  o.Waste = ties_detail::share_part(totwaste, ties_detail::pct_theirs(b.mem[831]));
}

// Robots.bas:1931-1953 — shareshell: publica mem(823) en AMBOS extremos.
inline void shareshell(Sim& sim, int t, int k) {
  Bot& b = sim.rob[t];
  Bot& o = sim.rob[b.Ties[k].pnt];
  if (b.mem[832] > 99) b.mem[832] = 99;
  if (b.mem[832] < 0) b.mem[832] = 0;
  const vb_single totshell = b.shell + o.shell;
  o.shell = ties_detail::share_part(totshell, ties_detail::pct_theirs(b.mem[832]));
  b.shell = ties_detail::share_part(totshell, ties_detail::pct_mine(b.mem[832]));
  b.mem[823] = vb_cint(b.shell);
  o.mem[823] = vb_cint(o.shell);
}

// Robots.bas:534-560 — definida en robots.hpp (necesita DNAtoInt de
// mutations.hpp); declaración adelantada para sharechloroplasts.
inline vb_single DoGeneticDistance(Sim& sim, int r1, int r2);

// Robots.bas:1866-1892 — sharechloroplasts: distancia genética > 0.25 pone
// un delay de 8 ciclos y no comparte; si no, reparto con caps 32000
// (destruye el exceso en silencio, como los demás share*).
inline void sharechloroplasts(Sim& sim, int t, int k) {
  Bot& b = sim.rob[t];
  if (DoGeneticDistance(sim, t, b.Ties[k].pnt) > 0.25f) {
    b.Chlr_Share_Delay = 8;
    return;
  }
  Bot& o = sim.rob[b.Ties[k].pnt];
  if (b.mem[addr::sharechlr] > 99) b.mem[addr::sharechlr] = 99;
  if (b.mem[addr::sharechlr] < 0) b.mem[addr::sharechlr] = 0;
  const vb_single totchlr = b.chloroplasts + o.chloroplasts;
  b.chloroplasts =
      ties_detail::share_part(totchlr, ties_detail::pct_mine(b.mem[addr::sharechlr]));
  o.chloroplasts =
      ties_detail::share_part(totchlr, ties_detail::pct_theirs(b.mem[addr::sharechlr]));
}

namespace ties_detail {

// Los bloques de transferencia por tieloc negativo (-1 nrg, -3 venom,
// -4 waste, -6 body) de Update_Ties (Ties.bas:339-645). Transcritos
// completos, capa torneo incluida (E5): dar/tomar nrg o body a través de
// una tie con un rival descalifica bajo Disqualify = 1.
// Los `l * 0.7`, `* 0.029`, `* 0.01`... son literales Double: cada
// acumulacion va en Double con un solo redondeo al asignar (RV-20).
inline void tie_transfers(Sim& sim, int t, vb_integer tn) {
  Bot& b = sim.rob[t];
  constexpr int tp = addr::tieport1;

  if (b.mem[tp + 2] >= 0) return;

  if (b.mem[tp + 2] == -1 && b.mem[tp + 3] != 0) {  // nrg
    vb_single l = b.mem[tp + 3];
    if (b.body < 0.0f) l = 0;
    if (b.nrg < 0.0f) l = 0;
    if (b.age == 0) l = 0;
    if (l > 1000.0f) l = 1000.0f;
    if (l < -3000.0f) l = -3000.0f;
    int k = 1;
    while (k <= MAXTIES && b.Ties[k].pnt > 0) {
      if (b.Ties[k].Port == tn) {
        Bot& o = sim.rob[b.Ties[k].pnt];
        if (l > 0.0f) {
          if (l > b.nrg) l = b.nrg;
          o.nrg = static_cast<vb_single>(static_cast<double>(o.nrg) + static_cast<double>(l) * 0.7);
          if (o.nrg > 32000.0f) o.nrg = 32000.0f;
          o.body = static_cast<vb_single>(static_cast<double>(o.body) + static_cast<double>(l) * 0.029);
          if (o.body > 32000.0f) o.body = 32000.0f;
          o.Waste = static_cast<vb_single>(static_cast<double>(o.Waste) + static_cast<double>(l) * 0.01);
          o.radius = FindRadius(sim, b.Ties[k].pnt);
          b.nrg -= l;
          // E5 (Ties.bas:370-371) — Disqualify = 1.
          if ((sim.opts.F1 || sim.x_restartmode == 1) &&
              sim.Disqualify == 1 && b.FName != o.FName)
            dreason(sim, b.FName, b.tag, "giving energy to opponent");
          if (!sim.opts.F1 && b.dq == 1 && sim.Disqualify == 1 &&
              b.FName != o.FName)
            b.Dead = true;
        }
        if (l < 0.0f) {
          if (l < -o.nrg) l = -o.nrg;
          const vb_single ptag = std::fabs(l / 4.0f);
          if (o.poison > ptag && o.FName != b.FName) {
            b.Poisoned = true;
            b.Poisoncount += ptag;
            if (b.Poisoncount > 32000.0f) b.Poisoncount = 32000.0f;
            l = 0;
            o.poison -= ptag;
            o.mem[827] = vb_cint(o.poison);
            if (o.mem[834] > 0) {
              b.Ploc = static_cast<vb_integer>((o.mem[834] - 1) % 1000 + 1);
              if (b.Ploc == 340) b.Ploc = 0;
            } else {
              do {
                b.Ploc = static_cast<vb_integer>(Random(1, 1000, *sim.rndy));
              } while (b.Ploc == 340);
            }
            b.Pval = o.mem[839];
          }
          b.nrg = static_cast<vb_single>(static_cast<double>(b.nrg) - static_cast<double>(l) * 0.7);
          if (b.nrg > 32000.0f) b.nrg = 32000.0f;
          b.body = static_cast<vb_single>(static_cast<double>(b.body) - static_cast<double>(l) * 0.029);
          if (b.body > 32000.0f) b.body = 32000.0f;
          b.Waste = static_cast<vb_single>(static_cast<double>(b.Waste) - static_cast<double>(l) * 0.01);
          b.radius = FindRadius(sim, t);
          o.nrg += l;
          if (o.nrg <= 0.0f && !o.Dead) {
            if (!o.Corpse) {
              b.Kills += 1;
              if (b.Kills > 32000) b.Kills = 32000;
              b.mem[220] = static_cast<vb_integer>(b.Kills);
            }
          }
          // E5 (Ties.bas:425-426) — Disqualify = 1.
          if ((sim.opts.F1 || sim.x_restartmode == 1) &&
              sim.Disqualify == 1 && b.FName != o.FName)
            dreason(sim, b.FName, b.tag, "taking energy from opponent");
          if (!sim.opts.F1 && b.dq == 1 && sim.Disqualify == 1 &&
              b.FName != o.FName)
            b.Dead = true;
        }
        if (!b.Ties[k].back)
          b.Ties[k].nrgused = true;
        else
          sim.rob[b.Ties[k].pnt].Ties[b.Ties[k].ptt].nrgused = true;
      }
      k += 1;
    }
  }

  if (b.mem[tp + 2] == -3 && b.mem[tp + 3] != 0) {  // venom
    vb_single l = b.mem[tp + 3];
    if (l > 100.0f) l = 100.0f;
    if (l < -100.0f) l = -100.0f;
    int k = 1;
    while (k <= MAXTIES && b.Ties[k].pnt > 0) {
      if (b.Ties[k].Port == tn) {
        Bot& o = sim.rob[b.Ties[k].pnt];
        if (l > b.venom) l = b.venom;
        if (l > 0.0f) {
          o.Paracount += l;
          if (o.Paracount > 32000.0f) o.Paracount = 32000.0f;
          o.Paralyzed = true;
          if (b.mem[835] > 0) {
            o.Vloc = static_cast<vb_integer>((b.mem[835] - 1) % 1000 + 1);
            if (o.Vloc == 340) o.Vloc = 0;
          } else {
            do {
              o.Vloc = static_cast<vb_integer>(Random(1, 1000, *sim.rndy));
            } while (o.Vloc == 340);
          }
          o.Vval = b.mem[836];
          b.venom -= l;
          b.mem[825] = vb_cint(b.venom);
        }
        if (l < 0.0f) {
          if (l < -o.venom) l = -o.venom;
          o.venom += l;
          b.venom -= l;
          if (b.venom > 32000.0f) b.venom = 32000.0f;
          b.mem[825] = vb_cint(b.venom);
        }
        if (!b.Ties[k].back)
          b.Ties[k].nrgused = true;
        else
          sim.rob[b.Ties[k].pnt].Ties[b.Ties[k].ptt].nrgused = true;
      }
      k += 1;
    }
  }

  if (b.mem[tp + 2] == -4 && b.mem[tp + 3] != 0) {  // waste
    vb_single l = b.mem[tp + 3];
    if (l > 1000.0f) l = 1000.0f;
    if (l < -1000.0f) l = -1000.0f;
    int k = 1;
    while (k <= MAXTIES && b.Ties[k].pnt > 0) {
      if (b.Ties[k].Port == tn) {
        Bot& o = sim.rob[b.Ties[k].pnt];
        if (l > 0.0f) {
          if (l > b.Waste) l = b.Waste;
          o.Waste = static_cast<vb_single>(static_cast<double>(o.Waste) + static_cast<double>(l) * 0.99);
          b.Waste -= l;
          b.Pwaste = static_cast<vb_single>(static_cast<double>(b.Pwaste) + static_cast<double>(l) * 0.01);
        }
        if (l < 0.0f) {
          if (l < -o.Waste) l = -o.Waste;
          b.Waste = static_cast<vb_single>(static_cast<double>(b.Waste) - static_cast<double>(l) * 0.99);
          o.Waste += l;
          o.Pwaste = static_cast<vb_single>(static_cast<double>(o.Pwaste) - static_cast<double>(l) * 0.01);
        }
        if (!b.Ties[k].back)
          b.Ties[k].nrgused = true;
        else
          sim.rob[b.Ties[k].pnt].Ties[b.Ties[k].ptt].nrgused = true;
      }
      k += 1;
    }
  }

  if (b.mem[tp + 2] == -6 && b.mem[tp + 3] != 0) {  // body
    vb_single l = b.mem[tp + 3];
    if (b.body < 0.0f) l = 0;
    if (b.nrg < 0.0f) l = 0;
    if (b.age == 0) l = 0;
    if (l > 100.0f) l = 100.0f;
    if (l < -300.0f) l = -300.0f;
    int k = 1;
    while (k <= MAXTIES && b.Ties[k].pnt > 0) {
      if (b.Ties[k].Port == tn) {
        Bot& o = sim.rob[b.Ties[k].pnt];
        if (l > 0.0f) {
          if (l > b.body) l = b.body;
          o.nrg = static_cast<vb_single>(static_cast<double>(o.nrg) + static_cast<double>(l) * 0.03);
          if (o.nrg > 32000.0f) o.nrg = 32000.0f;
          o.body = static_cast<vb_single>(static_cast<double>(o.body) + static_cast<double>(l) * 0.987);
          if (o.body > 32000.0f) o.body = 32000.0f;
          o.Waste = static_cast<vb_single>(static_cast<double>(o.Waste) + static_cast<double>(l) * 0.01);
          o.radius = FindRadius(sim, b.Ties[k].pnt);
          b.body -= l;
          // E5 (Ties.bas:576-577) — Disqualify = 1.
          if ((sim.opts.F1 || sim.x_restartmode == 1) &&
              sim.Disqualify == 1 && b.FName != o.FName)
            dreason(sim, b.FName, b.tag, "giving body to opponent");
          if (!sim.opts.F1 && b.dq == 1 && sim.Disqualify == 1 &&
              b.FName != o.FName)
            b.Dead = true;
        }
        if (l < 0.0f) {
          if (l < -o.body) l = -o.body;
          const vb_single ptag = std::fabs(l / 4.0f);
          if (o.poison > ptag && o.FName != b.FName) {
            b.Poisoned = true;
            b.Poisoncount += ptag;
            if (b.Poisoncount > 32000.0f) b.Poisoncount = 32000.0f;
            l = 0;
            o.poison -= ptag;
            o.mem[827] = vb_cint(o.poison);
            if (o.mem[834] > 0) {
              b.Ploc = static_cast<vb_integer>((o.mem[834] - 1) % 1000 + 1);
              if (b.Ploc == 340) b.Ploc = 0;
            } else {
              do {
                b.Ploc = static_cast<vb_integer>(Random(1, 1000, *sim.rndy));
              } while (b.Ploc == 340);
            }
            b.Pval = o.mem[839];
          }
          b.nrg = static_cast<vb_single>(static_cast<double>(b.nrg) - static_cast<double>(l) * 0.03);
          if (b.nrg > 32000.0f) b.nrg = 32000.0f;
          b.body = static_cast<vb_single>(static_cast<double>(b.body) - static_cast<double>(l) * 0.987);
          if (b.body > 32000.0f) b.body = 32000.0f;
          b.Waste = static_cast<vb_single>(static_cast<double>(b.Waste) - static_cast<double>(l) * 0.01);
          b.radius = FindRadius(sim, t);
          o.body += l;
          if (o.body <= 0.0f && !o.Dead) {  // (esta vía no excluye corpses)
            b.Kills += 1;
            if (b.Kills > 32000) b.Kills = 32000;
            b.mem[220] = static_cast<vb_integer>(b.Kills);
          }
          // E5 (Ties.bas:629-630) — Disqualify = 1.
          if ((sim.opts.F1 || sim.x_restartmode == 1) &&
              sim.Disqualify == 1 && b.FName != o.FName)
            dreason(sim, b.FName, b.tag, "taking body from opponent");
          if (!sim.opts.F1 && b.dq == 1 && sim.Disqualify == 1 &&
              b.FName != o.FName)
            b.Dead = true;
        }
        if (!b.Ties[k].back)
          b.Ties[k].nrgused = true;
        else
          sim.rob[b.Ties[k].pnt].Ties[b.Ties[k].ptt].nrgused = true;
      }
      k += 1;
    }
  }

  b.mem[tp + 2] = 0;
  b.mem[tp + 3] = 0;
}

}  // namespace ties_detail

// Ties.bas:123-651 — Update_Ties (P3): compartición, deltie, fixang/fixlen/
// stifftie con sus gates (M-04), tieang/tielen 1-4, transferencias y resets.
inline void Update_Ties(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  constexpr int tp = addr::tieport1;
  const vb_integer tn0 = b.mem[addr::TIENUM];

  int k = 1;
  b.vbody = b.body;
  bool atleast1tie = false;
  while (k <= MAXTIES && b.Ties[k].pnt > 0) {
    if (b.Multibot) {
      if (!b.Ties[k].back) {
        if (b.mem[830] > 0) {
          sharenrg(sim, t, k);
          b.Ties[k].sharing = true;
        }
        if (b.mem[831] > 0) {
          sharewaste(sim, t, k);
          b.Ties[k].sharing = true;
        }
        if (b.mem[832] > 0) {
          shareshell(sim, t, k);
          b.Ties[k].sharing = true;
        }
        if (b.mem[833] > 0) {
          shareslime(sim, t, k);
          b.Ties[k].sharing = true;
        }
        if (b.mem[addr::sharechlr] > 0 && b.Chlr_Share_Delay == 0 &&
            !b.NoChlr) {
          sharechloroplasts(sim, t, k);
          b.Ties[k].sharing = true;
        }
      }
      b.vbody += sim.rob[b.Ties[k].pnt].body;
      if (b.FName == sim.rob[b.Ties[k].pnt].FName) atleast1tie = true;
    }
    k += 1;
  }
  if (b.multibot_time > 0) {
    if (atleast1tie) b.multibot_time += 1;
    if (!atleast1tie) b.multibot_time -= 1;
    if (b.multibot_time > 210) b.multibot_time = 210;
    if (b.multibot_time < 10) b.Dead = true;
  }

  // Zero out the sharing sysvars (Ties.bas:180-184): el régimen C de M-11.
  b.mem[830] = 0;
  b.mem[831] = 0;
  b.mem[832] = 0;
  b.mem[833] = 0;
  b.mem[addr::sharechlr] = 0;

  b.numties = static_cast<vb_single>(k - 1);
  b.mem[addr::numties] = static_cast<vb_integer>(k - 1);

  if (b.numties == 0.0f) {
    b.Multibot = false;
    b.mem[addr::multi] = 0;
    return;
  }

  // deltie (Ties.bas:196-202)
  if (b.mem[addr::DELTIE] != 0) {
    const int nt = vb_cint(b.numties);
    for (k = 1; k <= nt; ++k)
      if (b.Ties[k].pnt > 0 && b.Ties[k].Port == b.mem[tp + 17])
        DeleteTie(sim, t, b.Ties[k].pnt);
    b.mem[addr::DELTIE] = 0;
  }

  vb_integer tn = tn0;
  if (tn == 0) tn = b.mem[addr::TIEPRES];
  if (tn == 0) return;  // sin selección de tie: fixang/fixlen/stifftie
                        // PERSISTEN (gate de M-04)

  k = 1;
  while (k < MAXTIES && b.Ties[k].pnt > 0) {
    if (b.Multibot && b.Ties[k].type == 3) {
      // fixang (Ties.bas:231-248): centinela 32000, no 0.
      if (b.mem[addr::FIXANG] != 32000 && b.Ties[k].Port == tn) {
        if (b.mem[addr::FIXANG] >= 0) {
          b.Ties[k].ang =
              static_cast<vb_single>(b.mem[addr::FIXANG] % 1256) / 200.0f;
          b.Ties[k].angreg = true;
        } else {
          b.Ties[k].angreg = false;
        }
      }
      // fixlen (Ties.bas:251-258)
      if (b.mem[addr::FIXLEN] != 0 && b.Ties[k].Port == tn) {
        // Integer + Single + Single asignado a Long: CLng de la suma (RV-19).
        vb_long Length = vb_clng(
            static_cast<double>(std::abs(static_cast<vb_long>(b.mem[addr::FIXLEN]))) +
            static_cast<double>(b.radius) +
            static_cast<double>(sim.rob[b.Ties[k].pnt].radius));
        if (Length > 32000) Length = 32000;
        b.Ties[k].NaturalLength = static_cast<vb_single>(Length);
        // srctie puede devolver 0: el original escribe en Ties(0), el slot
        // 0 sin uso — se replica tal cual.
        const int st = srctie(sim, b.Ties[k].pnt, t);
        sim.rob[b.Ties[k].pnt].Ties[st].NaturalLength =
            static_cast<vb_single>(Length);
      }
      // stifftie (Ties.bas:261-269): Mod 100 in place, 0 -> 100, <0 -> 1.
      if (b.mem[addr::stifftie] != 0 && b.Ties[k].Port == tn) {
        b.mem[addr::stifftie] = static_cast<vb_integer>(b.mem[addr::stifftie] % 100);
        if (b.mem[addr::stifftie] == 0) b.mem[addr::stifftie] = 100;
        if (b.mem[addr::stifftie] < 0) b.mem[addr::stifftie] = 1;
        // Literal Double * Integer: un solo redondeo al asignar (RV-20).
        const vb_single sb = static_cast<vb_single>(0.005 * b.mem[addr::stifftie]);
        const vb_single sk = static_cast<vb_single>(0.0025 * b.mem[addr::stifftie]);
        b.Ties[k].b = sb;
        b.Ties[k].k = sk;
        const int st = srctie(sim, b.Ties[k].pnt, t);
        sim.rob[b.Ties[k].pnt].Ties[st].b = sb;
        sim.rob[b.Ties[k].pnt].Ties[st].k = sk;
      }
    }
    k += 1;
  }

  // Resets tras el gate tn != 0 (Ties.bas:277-279; M-04):
  b.mem[addr::FIXANG] = 32000;
  b.mem[addr::FIXLEN] = 0;
  b.mem[addr::stifftie] = 0;

  // tieang/tielen 1..4 por flags de overwrite (Ties.bas:287-316, V-12).
  if (b.Multibot) {
    for (k = 1; k <= 4; ++k) {
      if (b.Ties[k].pnt > 0 && b.Ties[k].type == 3) {
        if (b.TieLenOverwrite[k - 1]) {
          vb_long Length = vb_clng(  // CLng de la suma (RV-19)
              static_cast<double>(b.mem[483 + k]) + static_cast<double>(b.radius) +
              static_cast<double>(sim.rob[b.Ties[k].pnt].radius));
          if (Length > 32000) Length = 32000;
          b.Ties[k].NaturalLength = static_cast<vb_single>(Length);
          const int st = srctie(sim, b.Ties[k].pnt, t);
          sim.rob[b.Ties[k].pnt].Ties[st].NaturalLength =
              static_cast<vb_single>(Length);
        }
        if (b.TieAngOverwrite[k - 1]) {
          b.Ties[k].ang = angnorm(static_cast<vb_single>(b.mem[479 + k]) / 200.0f);
          b.Ties[k].angreg = true;
        }
        b.TieAngOverwrite[k - 1] = false;
        b.TieLenOverwrite[k - 1] = false;
        // salida: publica tielen/tieang de la tie k
        const int n = b.Ties[k].pnt;
        const vb_single tieAngle =
            vb_angle(b.pos.x, b.pos.y, sim.rob[n].pos.x, sim.rob[n].pos.y);
        vb_single dist = static_cast<vb_single>(std::sqrt(
            std::pow(static_cast<double>(b.pos.x) - sim.rob[n].pos.x, 2.0) +
            std::pow(static_cast<double>(b.pos.y) - sim.rob[n].pos.y, 2.0)));
        if (dist > 32000.0f) dist = 32000.0f;
        b.mem[483 + k] = vb_cint(dist - b.radius - sim.rob[n].radius);
        b.mem[479 + k] =
            vb_cint(angnorm(angnorm(tieAngle) - angnorm(b.aim)) * 200.0f);
      }
    }
  }

  ties_detail::tie_transfers(sim, t, tn);

  b.mem[tp + 5] = 0;  // .tienum se resetea cada ciclo (Ties.bas:648)
}

// Ties.bas:680-713 — readtie (P1).
inline void readtie(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  if (b.newage < 2) return;
  if (b.numties == 0.0f) {
    EraseTRefVars(sim, t);
    return;
  }
  vb_integer tn;
  if (b.mem[471] != 0)
    tn = b.mem[471];  // .readtie
  else
    tn = b.mem[454];  // .tiepres
  int k = 1;
  while (k <= MAXTIES && b.Ties[k].pnt > 0) {
    if (b.Ties[k].Port == tn) {
      ReadTRefVars(sim, t, k);
      return;
    }
    k += 1;
  }
  EraseTRefVars(sim, t);
}

}  // namespace db
