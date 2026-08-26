// dbcore/physics.hpp — Physics.bas completo para el ciclo: NetForces
// (fricción/arrastre/brownianas/gravedad/VoluntaryForces), Repel3 con su
// respuesta de impulso y efectos sensoriales inmediatos (F-06),
// bordercolls + ReSpawn/ListCells (Multibots.bas), la detección por buckets
// (Quads.bas:223-271), UpdatePosition (Robots.bas:826-879) y SetAimFunc.
// Contratos: 30-FISICA.md; casos F-01..F-07, F-13.
#pragma once

#include "buckets.hpp"
#include "senses.hpp"
#include "sim.hpp"

namespace db {

// Physics.bas:18 — smudgefactor.
inline constexpr vb_single smudgefactor = 50.0f;

// Physics.bas:44-52 — CalcMass: masa 1..32000, incluye cloroplastos.
inline void CalcMass(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  b.mass = (b.body / 1000.0f) + (b.shell / 200.0f) +
           (b.chloroplasts / 32000.0f) * 31680.0f;
  if (b.mass < 1.0f) b.mass = 1.0f;
  if (b.mass > 32000.0f) b.mass = 32000.0f;
}

// Physics.bas:73-105 — FrictionForces (Zgravity = 0 => sin efecto).
inline void FrictionForces(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (sim.opts.Zgravity == 0.0f) return;
  const vb_single ZGrav = sim.opts.Zgravity;
  b.ImpulseStatic = b.mass * ZGrav * sim.opts.CoefficientStatic;
  vb_single Impulse = b.mass * ZGrav * sim.opts.CoefficientKinetic;
  if (std::fabs(b.ma) > 0.0f) {
    if (Impulse < 48.0f)
      b.ma = b.ma * (48.0f - Impulse) / 48.0f;
    else
      b.ma = 0.0f;
    if (std::fabs(b.ma) < 0.0000001f) b.ma = 0.0f;
  }
  if (Impulse > VectorMagnitude(b.vel)) Impulse = VectorMagnitude(b.vel);
  if (Impulse < 0.0000001f) return;
  Vector u = VectorUnit(b.vel);
  b.vel = VectorSub(b.vel, VectorScalar(u, Impulse));
}

// Physics.bas:107-119 — BrownianForces: 3 extracciones de RNG si PhysBrown.
inline void BrownianForces(Sim& sim, int n) {
  if (sim.opts.PhysBrown == 0.0f) return;
  const vb_single Impulse = sim.opts.PhysBrown * 0.5f * sim.rnd();
  const vb_single RandomAngle = sim.rnd() * 2.0f * PI;
  Vector imp = VectorSet(
      static_cast<vb_single>(std::cos(static_cast<double>(RandomAngle))) * Impulse,
      static_cast<vb_single>(std::sin(static_cast<double>(RandomAngle))) * Impulse);
  sim.rob[n].ImpulseInd = VectorAdd(sim.rob[n].ImpulseInd, imp);
  sim.rob[n].ma += (Impulse / 100.0f) * (sim.rnd() - 0.5f);
}

// Physics.bas:54-70 — AddedMass (P0b, solo si Density != 0): masa de fluido
// desplazado; suma a la inercia, no a la gravedad.
inline void AddedMass(Sim& sim, int n) {
  constexpr vb_single fourthirdspi = 4.18879f;
  constexpr vb_single AddedMassCoefficientForASphere = 0.5f;
  Bot& b = sim.rob[n];
  if (sim.opts.Density == 0.0f)
    b.AddedMass = 0.0f;
  else
    b.AddedMass = AddedMassCoefficientForASphere * sim.opts.Density *
                  fourthirdspi * b.radius * b.radius * b.radius;
}

// Physics.bas:306-341 — SphereCd: coeficiente de arrastre por tramos de
// Reynolds, constantes literales.
inline vb_single SphereCd(Sim& sim, vb_single velocitymagnitude,
                          vb_single radius) {
  if (sim.opts.Viscosity == 0.0f) return 0.0f;
  if (velocitymagnitude < 0.00001f) velocitymagnitude = 0.00001f;
  const vb_single Reynolds =
      radius * 2 * velocitymagnitude * sim.opts.Density / sim.opts.Viscosity;

  const vb_single y11 = static_cast<vb_single>(24.0 / (3.0 * 100000.0));
  const vb_single y12 =
      static_cast<vb_single>(6.0 / (1.0 + std::sqrt(3.0 * 100000.0)));
  const vb_single y13 = 0.4f;
  const vb_single y1 = y11 + y12 + y13;
  const vb_single y2 = 0.09f;
  const vb_single alpha = static_cast<vb_single>(
      (static_cast<double>(y2) - y1) * std::pow(50000.0, -2.0));

  if (Reynolds == 0.0f) return 0.0f;
  if (Reynolds < 3.0f * 100000.0f)
    return static_cast<vb_single>(
        24.0 / Reynolds + 6.0 / (1.0 + std::sqrt(static_cast<double>(Reynolds))) +
        0.4);
  if (Reynolds < 3.5f * 100000.0f)
    return static_cast<vb_single>(
        alpha * std::pow(static_cast<double>(Reynolds) - 3.0 * 100000.0, 2.0) +
        y1);
  if (Reynolds < 6.0f * 100000.0f) return 0.09f;
  if (Reynolds < 4.0f * 1000000.0f)
    return static_cast<vb_single>(
        std::pow(static_cast<double>(Reynolds) / (6.0 * 100000.0), 0.55) * y2);
  return 0.255f;
}

// Physics.bas:121-156 — SphereDragForces: muta vel directamente y drena ma.
inline void SphereDragForces(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if ((b.vel.x == 0.0f && b.vel.y == 0.0f) || sim.opts.Density == 0.0f) return;

  if (std::fabs(b.ma) > 0.0f) {
    if (sim.opts.Density < 0.000001f)
      b.ma = b.ma * (1.0f - (sim.opts.Density * 1000000.0f));
    else
      b.ma = 0.0f;
    if (std::fabs(b.ma) < 0.0000001f) b.ma = 0.0f;
  }

  const vb_single mag = VectorMagnitude(b.vel);
  if (mag < 0.0000001f) return;

  vb_single Impulse = static_cast<vb_single>(
      0.5 * SphereCd(sim, mag, b.radius) * sim.opts.Density * mag * mag *
      (static_cast<double>(PI) *
       std::pow(static_cast<double>(b.radius), 2.0)));
  if (Impulse > mag) Impulse = mag * 0.99f;
  Vector u = VectorUnit(b.vel);
  Vector ImpulseVector = VectorScalar(u, Impulse);
  b.vel = VectorSub(b.vel, ImpulseVector);
}

// Physics.bas:385-407 — GravityForces: rama normal, y en pondmode no-toroidal
// la flotabilidad cobra energía y el signo depende de la profundidad relativa
// a 1/BouyancyScaling (mareas).
inline void GravityForces(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (sim.opts.Ygravity == 0.0f || !sim.opts.Pondmode ||
      sim.opts.Updnconnected) {
    b.ImpulseInd =
        VectorAdd(b.ImpulseInd, VectorSet(0.0f, sim.opts.Ygravity * b.mass));
  } else {
    if (b.Bouyancy > 0.0f) {
      // División por PhysMoving: con PhysMoving = 0 el original lanza error
      // 11 (30-FISICA.md §8). Decisión de port: la carga de opciones no
      // admite PhysMoving = 0; si ocurriera, se registra y no se cobra.
      if (sim.opts.PhysMoving != 0.0f) {
        b.nrg -= (sim.opts.Ygravity / sim.opts.PhysMoving *
                  ((b.mass > 192.0f) ? 192.0f : b.mass) *
                  sim.vm.costs.v[cost::MOVECOST] *
                  sim.vm.costs.v[cost::COSTMULTIPLIER]) *
                 b.Bouyancy;
      } else {
        sim.diag.err11_gravity_physmoving0 += 1;
      }
    }
    if ((1.0f / sim.BouyancyScaling - b.pos.y / sim.opts.FieldHeight) >
        b.Bouyancy)
      b.ImpulseInd =
          VectorAdd(b.ImpulseInd, VectorSet(0.0f, sim.opts.Ygravity * b.mass));
    else
      b.ImpulseInd = VectorAdd(b.ImpulseInd,
                               VectorSet(0.0f, -sim.opts.Ygravity * b.mass));
  }
}

// Physics.bas:409-463 — VoluntaryForces: lee los dir* escritos por el ADN en
// ESTE ciclo (M-02); nótese el (sx - dx) cruzado "a propósito" del fuente.
inline void VoluntaryForces(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.Corpse || b.DisableMovementSysvars || b.DisableDNA || !b.exist ||
      (b.mem[addr::dirup] == 0 && b.mem[addr::dirdn] == 0 &&
       b.mem[addr::dirsx] == 0 && b.mem[addr::dirdx] == 0))
    return;

  const vb_single mult = (b.NewMove == false) ? b.mass : 1.0f;

  Vector dir = VectorSet(
      static_cast<vb_single>(static_cast<vb_long>(b.mem[addr::dirup]) -
                             static_cast<vb_long>(b.mem[addr::dirdn])),
      static_cast<vb_single>(static_cast<vb_long>(b.mem[addr::dirsx]) -
                             static_cast<vb_long>(b.mem[addr::dirdx])));
  dir = VectorScalar(dir, mult);

  Vector NewAccel = VectorSet(Dot(b.aimvector, dir), Cross(b.aimvector, dir));

  if (VectorMagnitude(NewAccel) > sim.opts.MaxVelocity) {
    const vb_single scale = sim.opts.MaxVelocity / VectorMagnitude(NewAccel);
    NewAccel = VectorScalar(NewAccel, scale);
  }

  Vector scaled = VectorScalar(NewAccel, sim.opts.PhysMoving);
  b.ImpulseInd = VectorAdd(b.ImpulseInd, scaled);

  vb_single EnergyCost = VectorMagnitude(NewAccel) *
                         sim.vm.costs.v[cost::MOVECOST] *
                         sim.vm.costs.v[cost::COSTMULTIPLIER];
  if (EnergyCost > b.nrg) EnergyCost = b.nrg;
  if (EnergyCost < -1000.0f) EnergyCost = -1000.0f;
  b.nrg -= EnergyCost;
}

// Physics.bas:23-42 — NetForces (PlanetEaters es capa F1 ⚙: fuera).
inline void NetForces(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (std::fabs(b.vel.x) < 0.0000001f) b.vel.x = 0.0f;
  if (std::fabs(b.vel.y) < 0.0000001f) b.vel.y = 0.0f;
  FrictionForces(sim, n);
  SphereDragForces(sim, n);
  BrownianForces(sim, n);
  GravityForces(sim, n);
  VoluntaryForces(sim, n);
}

// Robots.bas:826-879 — UpdatePosition (P3): integra, satura a MaxVelocity,
// consume los dir* (régimen C de M-02) y publica vel*/mass/maxvel.
inline void UpdatePosition(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  vb_single vt = 0.0f;

  if (b.mass + b.AddedMass < 0.25f) b.mass = 0.25f - b.AddedMass;

  if (!b.Fixed) {
    Vector imp = b.ImpulseInd;
    b.vel = VectorAdd(b.vel, VectorScalar(imp, 1.0f / (b.mass + b.AddedMass)));
    b.ImpulseInd = imp;  // VectorScalar clampa ByRef; se refleja como el fuente
    vt = VectorMagnitudeSquare(b.vel);
    if (vt > sim.opts.MaxVelocity * sim.opts.MaxVelocity) {
      Vector u = VectorUnit(b.vel);
      b.vel = VectorScalar(u, sim.opts.MaxVelocity);
      vt = sim.opts.MaxVelocity * sim.opts.MaxVelocity;
    }
    b.pos = VectorAdd(b.pos, b.vel);
    UpdateBotBucket(sim, n);
  } else {
    b.vel = VectorSet(0.0f, 0.0f);
  }

  b.ImpulseInd = VectorSet(0.0f, 0.0f);
  b.ImpulseRes = b.ImpulseInd;
  b.ImpulseStatic = 0.0f;

  if (sim.opts.ZeroMomentum) b.vel = VectorSet(0.0f, 0.0f);

  b.lastup = b.mem[addr::dirup];
  b.lastdown = b.mem[addr::dirdn];
  b.lastleft = b.mem[addr::dirsx];
  b.lastright = b.mem[addr::dirdx];
  b.mem[addr::dirup] = 0;
  b.mem[addr::dirdn] = 0;
  b.mem[addr::dirdx] = 0;
  b.mem[addr::dirsx] = 0;

  b.mem[addr::velscalar] =
      iceil(static_cast<vb_single>(std::sqrt(static_cast<double>(vt))));
  const double ca = std::cos(static_cast<double>(b.aim));
  const double sa = std::sin(static_cast<double>(b.aim));
  b.mem[addr::vel] = iceil(static_cast<vb_single>(ca * b.vel.x + sa * b.vel.y * -1.0));
  b.mem[addr::veldn] = static_cast<vb_integer>(-b.mem[addr::vel]);
  b.mem[addr::veldx] = iceil(static_cast<vb_single>(sa * b.vel.x + ca * b.vel.y));
  b.mem[addr::velsx] = static_cast<vb_integer>(-b.mem[addr::veldx]);

  b.mem[addr::masssys] = vb_cint(b.mass);
  b.mem[addr::maxvelsys] = vb_cint(sim.opts.MaxVelocity);
}

// Robots.bas:774-822 — SetAimFunc (P3): giro por aimsx/aimdx/setaim, publica
// mem(18) y resetea mem(19) al aim actual.
inline void SetAimFunc(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  vb_single diff = static_cast<vb_single>(b.mem[addr::aimsx]) -
                   static_cast<vb_single>(b.mem[addr::aimdx]);
  vb_single diff2 = 0.0f;
  vb_single result;

  if (b.mem[addr::SetAim] ==
      vb_round64(static_cast<double>(b.aim) * 200.0)) {
    result = b.aim * 200.0f + diff;
  } else {
    result = b.mem[addr::SetAim];
    diff = -AngDiff(b.aim,
                    angnorm(static_cast<vb_single>(b.mem[addr::SetAim]) / 200.0f)) *
           200.0f;
    diff2 = static_cast<vb_single>(
                std::abs(vb_round64((static_cast<double>(b.aim) * 200.0 -
                                     b.mem[addr::SetAim]) /
                                    1256.0) *
                         1256)) *
            static_cast<vb_single>(vb_sgn(diff));
  }

  // Round((diff+diff2)/200, 3): bancario a 3 decimales.
  const double turn =
      static_cast<double>(vb_round64(static_cast<double>(diff + diff2) / 200.0 *
                                     1000.0)) /
      1000.0;
  b.nrg -= static_cast<vb_single>(
      std::fabs(turn * sim.vm.costs.v[cost::TURNCOST] *
                sim.vm.costs.v[cost::COSTMULTIPLIER]));

  // SetAimFunc = SetAimFunc Mod 1256 — Mod de VB6 sobre Single: redondeo
  // bancario a Long primero.
  vb_long r = static_cast<vb_long>(vb_round64(static_cast<double>(result))) % 1256;
  if (r < 0) r += 1256;
  result = static_cast<vb_single>(r) / 200.0f;

  while (b.ma > 2.0f * PI) b.ma -= 2.0f * PI;
  while (b.ma < -2.0f * PI) b.ma += 2.0f * PI;

  b.aim = result + b.ma;

  if (b.ma > 0.0f && diff < 0.0f) {
    b.ma += (diff + diff2) / 200.0f;
    if (b.ma < 0.0f) b.ma = 0.0f;
  }
  if (b.ma < 0.0f && diff > 0.0f) {
    b.ma += (diff + diff2) / 200.0f;
    if (b.ma > 0.0f) b.ma = 0.0f;
  }

  b.aimvector = VectorSet(
      static_cast<vb_single>(std::cos(static_cast<double>(b.aim))),
      static_cast<vb_single>(std::sin(static_cast<double>(b.aim))));

  b.mem[addr::aimsx] = 0;
  b.mem[addr::aimdx] = 0;
  b.mem[addr::AimSys] = vb_cint(static_cast<double>(b.aim) * 200.0);
  b.mem[addr::SetAim] = b.mem[addr::AimSys];
}

// Physics.bas:845-976 — Repel3: separación posicional directa, impulso
// elástico 1-D sobre la línea de centros (fijo = masa 32000) y efectos
// sensoriales inmediatos en ambos bots (F-06, M-01).
inline void Repel3(Sim& sim, int rob1, int rob2) {
  Bot& r1 = sim.rob[rob1];
  Bot& r2 = sim.rob[rob2];
  const vb_single e = sim.opts.CoefficientElasticity;

  Vector normal = VectorSub(r2.pos, r1.pos);
  const vb_single currdist = VectorMagnitude(normal);

  if ((r1.Fixed && r2.Fixed) ||
      (VectorMagnitude(r1.vel) < 0.0001f &&
       VectorMagnitude(r2.vel) < 0.0001f)) {
    // Ambos fijos o ambos quietos: mitad y mitad, sin masas.
    const vb_single fixedSep = ((r1.radius + r2.radius) - currdist) / 2.0f;
    Vector u = VectorUnit(normal);
    Vector fixedSepVector = VectorScalar(u, fixedSep);
    r1.pos = VectorSub(r1.pos, fixedSepVector);
    r2.pos = VectorAdd(r2.pos, fixedSepVector);
  } else {
    // Retroceso suavizado repartido por masas INVERTIDAS (el ligero se mueve
    // más).
    const vb_single TotalMass = r1.mass + r2.mass;
    const vb_single fixedSep = (r1.radius + r2.radius) - currdist;
    Vector u = VectorUnit(normal);
    Vector fixedSepVector = VectorScalar(
        u, static_cast<vb_single>(
               fixedSep /
               (1.0 + std::pow(55.0, 0.3 - static_cast<double>(e)))));
    r1.pos = VectorSub(r1.pos,
                       VectorScalar(fixedSepVector, r2.mass / TotalMass));
    r2.pos = VectorAdd(r2.pos,
                       VectorScalar(fixedSepVector, r1.mass / TotalMass));
  }

  if (VectorInvMagnitude(normal) != -1.0f) {
    vb_single M1 = r1.mass;
    vb_single M2 = r2.mass;
    if (r1.Fixed) M1 = 32000.0f;
    if (r2.Fixed) M2 = 32000.0f;

    Vector unit = VectorUnit(normal);
    Vector vel1 = r1.vel;
    Vector vel2 = r2.vel;

    vb_single projection = Dot(vel1, unit) * 0.99f;
    if (projection <= 0.0f) projection = 0.000001f;  // ya se alejan
    Vector V1 = VectorScalar(unit, projection);

    projection = Dot(vel2, unit) * 0.99f;
    if (projection >= 0.0f) projection = -0.000001f;
    Vector V2 = VectorScalar(unit, projection);

    Vector t1 = VectorScalar(V2, (e + 1.0f) * M2);
    Vector t2 = VectorScalar(V1, M1 - e * M2);
    Vector sum1 = VectorAdd(t1, t2);
    Vector V1f = VectorScalar(sum1, 1.0f / (M1 + M2));

    Vector t3 = VectorScalar(V1, (e + 1.0f) * M1);
    Vector t4 = VectorScalar(V2, M2 - e * M1);
    Vector sum2 = VectorAdd(t3, t4);
    Vector V2f = VectorScalar(sum2, 1.0f / (M1 + M2));

    if (!r1.Fixed) r1.vel = VectorAdd(VectorSub(r1.vel, V1), V1f);
    if (!r2.Fixed) r2.vel = VectorAdd(VectorSub(r2.vel, V2), V2f);

    touch(sim, rob1, r2.pos.x, r2.pos.y);
    touch(sim, rob2, r1.pos.x, r1.pos.y);
    r1.lasttch = rob2;
    r2.lasttch = rob1;
    lookoccurr(sim, rob1, rob2);
    lookoccurr(sim, rob2, rob1);
  }
}

// Multibots.bas:78-114 — ListCells: lista las células del organismo desde
// lst[0]. Los topes literales (50) y la escritura en lst(50) se replican.
inline void ListCells(Sim& sim, std::array<vb_integer, 51>& lst) {
  int w = 0;
  vb_long n = lst[0];
  while (n > 0) {
    Bot& b = sim.rob[n];
    if (b.Multibot) {
      int k = 1;
      // El While del fuente no acota k: con 10 ties leería Ties(11) (error
      // 9); inalcanzable con el máximo real de 9 ties de maketie.
      while (k <= MAXTIES && b.Ties[k].pnt > 0) {
        bool pres = false;
        int j = 0;
        while (lst[j] > 0) {
          if (lst[j] == b.Ties[k].pnt) pres = true;
          j += 1;
          if (j == 50) lst[j] = 0;
        }
        if (!pres) lst[j] = b.Ties[k].pnt;
        k += 1;
      }
    }
    w += 1;
    if (w > 50) {
      w = 50;
      lst[w] = 0;
      return;
    }
    n = lst[w];
  }
}

// Multibots.bas:9-49 — ReSpawn: traslada el organismo ENTERO (hasta 50
// células) y sincroniza opos = pos de cada célula para que actvel no
// registre el salto (30-FISICA.md §5).
inline void ReSpawn(Sim& sim, int n, vb_single X, vb_single Y) {
  std::array<vb_integer, 51> clist{};
  clist[0] = static_cast<vb_integer>(n);
  ListCells(sim, clist);
  double Minv = 999999999999.0;
  int nmin = 0;
  int t = 0;
  while (clist[t] > 0) {
    const double d =
        std::pow(static_cast<double>(sim.rob[clist[t]].pos.x) - X, 2.0) +
        std::pow(static_cast<double>(sim.rob[clist[t]].pos.y) - Y, 2.0);
    if (d <= Minv) {
      Minv = d;
      nmin = clist[t];
    }
    t += 1;
    if (t > 50) return;
  }
  vb_single dx = X - sim.rob[nmin].pos.x;
  vb_single dy = Y - sim.rob[nmin].pos.y;

  const vb_single radiidif = sim.rob[n].radius - sim.rob[nmin].radius;
  dx = dx - 1 * static_cast<vb_single>(vb_sgn(dx)) +
       static_cast<vb_single>(vb_sgn(dx)) * radiidif;
  dy = dy - 1 * static_cast<vb_single>(vb_sgn(dy)) +
       static_cast<vb_single>(vb_sgn(dy)) * radiidif;

  t = 0;
  while (clist[t] > 0) {
    sim.rob[clist[t]].pos.x = sim.rob[clist[t]].pos.x + dx;
    sim.rob[clist[t]].pos.y = sim.rob[clist[t]].pos.y + dy;
    sim.rob[clist[t]].opos.x = sim.rob[clist[t]].pos.x;
    sim.rob[clist[t]].opos.y = sim.rob[clist[t]].pos.y;
    UpdateBotBucket(sim, clist[t]);
    t += 1;
    if (t > 50) return;  // el While del fuente indexaría clist(51): error 9
  }
}

// Physics.bas:774-841 — bordercolls: toroidal => ReSpawn al borde opuesto;
// rígido => mem(214) = 1, clamp de posición y amortiguador vel*0.05 en
// ImpulseRes (el término de muelle k = 0.4 está comentado en el fuente).
inline void bordercolls(Sim& sim, int t) {
  constexpr vb_single b = 0.05f;
  Bot& r = sim.rob[t];

  if (r.pos.x > r.radius && r.pos.x < sim.opts.FieldWidth - r.radius &&
      r.pos.y > r.radius && r.pos.y < sim.opts.FieldHeight - r.radius)
    return;

  r.mem[214] = 0;

  const vb_single smudge = r.radius + smudgefactor;

  Vector lo = VectorSet(smudge, smudge);
  Vector hi = VectorSet(sim.opts.FieldWidth - smudge,
                        sim.opts.FieldHeight - smudge);
  Vector dif = VectorMin(VectorMax(r.pos, lo), hi);
  Vector dist = VectorSub(dif, r.pos);

  if (dist.x != 0.0f) {
    if (sim.opts.Dxsxconnected) {
      if (dist.x < 0.0f)
        ReSpawn(sim, t, smudge, r.pos.y);
      else
        ReSpawn(sim, t, sim.opts.FieldWidth - smudge, r.pos.y);
    } else {
      r.mem[214] = 1;
      if (r.pos.x - r.radius < 0.0f) r.pos.x = r.radius;
      if (r.pos.x + r.radius > sim.opts.FieldWidth)
        r.pos.x = sim.opts.FieldWidth - r.radius;
      r.ImpulseRes.x = r.ImpulseRes.x + r.vel.x * b;
    }
  }

  if (dist.y != 0.0f) {
    if (sim.opts.Updnconnected) {
      if (dist.y < 0.0f)
        ReSpawn(sim, t, r.pos.x, smudge);
      else
        ReSpawn(sim, t, r.pos.x, sim.opts.FieldHeight - smudge);
    } else {
      r.mem[214] = 1;
      if (r.pos.y - r.radius < 0.0f) r.pos.y = r.radius;
      if (r.pos.y + r.radius > sim.opts.FieldHeight)
        r.pos.y = sim.opts.FieldHeight - r.radius;
      r.ImpulseRes.y = r.ImpulseRes.y + r.vel.y * b;
    }
  }
}

// Quads.bas:245-271 — CheckBotBucketForCollision: solo pares robnumber > n
// (cada par una vez, índice menor manda), solape con
// VectorMagnitudeSquare sobre una copia local (el clamp ByRef es inofensivo).
// hidepred: capa torneo ⚙, fuera.
inline void CheckBotBucketForCollision(Sim& sim, int n, const Vector& pos) {
  BucketType& bk = BucketAt(sim, static_cast<int>(pos.x),
                            static_cast<int>(pos.y));
  if (bk.size == 0) return;
  int a = 1;
  while (bk.arr[a] != -1) {
    const int robnumber = bk.arr[a];
    if (robnumber > n) {
      Vector distvector = VectorSub(sim.rob[n].pos, sim.rob[robnumber].pos);
      const vb_single dist = sim.rob[n].radius + sim.rob[robnumber].radius;
      if (VectorMagnitudeSquare(distvector) < dist * dist)
        Repel3(sim, n, robnumber);
    }
    if (a == bk.size) return;
    a += 1;
  }
}

// Quads.bas:223-243 — BucketsCollision: celda propia + hasta 8 adyacentes.
inline void BucketsCollision(Sim& sim, int n) {
  EnsureBuckets(sim);
  if (sim.rob[n].BucketPos.x < 0 || sim.rob[n].BucketPos.y < 0)
    UpdateBotBucket(sim, n);  // defensivo (ver BucketsProximity)
  const Vector BucketPos = sim.rob[n].BucketPos;

  CheckBotBucketForCollision(sim, n, BucketPos);

  for (int x = 1; x <= 8; ++x) {
    const Vector adjBucket =
        BucketAt(sim, static_cast<int>(BucketPos.x),
                 static_cast<int>(BucketPos.y))
            .adjBucket[x];
    if (adjBucket.x != -1.0f)
      CheckBotBucketForCollision(sim, n, adjBucket);
    else
      break;
  }
}

// ---------------------------------------------------------------------------
// Obstacles.bas (50-MUNDO.md §4): formas del mundo. La creación con Rnd
// CRUDO (AddRandomObstacles, colores — B7-5) es capa de setup/UI: fuera del
// flujo rndy y del core; NewObstacle recibe el color ya decidido (0 si
// makeAllShapesBlack, que en VB6 es vbBlack = 0).

// Obstacles.bas:190-212 — NewObstacle: alta secuencial con tope 1000.
inline int NewObstacle(Sim& sim, vb_single x, vb_single y, vb_single Width,
                       vb_single Height, vb_long color = 0) {
  if (sim.numObstacles + 1 > 1000) return -1;  // MAXOBSTACLES
  sim.numObstacles += 1;
  if (static_cast<int>(sim.Obstacles.size()) <= sim.numObstacles)
    sim.Obstacles.resize(sim.numObstacles + 1);
  Obstacle& o = sim.Obstacles[sim.numObstacles];
  o.exist = true;
  o.pos.x = x;
  o.pos.y = y;
  o.Width = Width;
  o.Height = Height;
  o.vel = {0.0f, 0.0f};
  o.color = sim.opts.makeAllShapesBlack ? 0 : color;
  return sim.numObstacles;
}

// Obstacles.bas:152-163 — TrashCompactorMove: los dos muros del compactador
// invierten rumbo al cruzarse (+400) y re-arman al salir por la izquierda.
inline void TrashCompactorMove(Sim& sim) {
  Obstacle& L = sim.Obstacles[sim.leftCompactor];
  Obstacle& R = sim.Obstacles[sim.rightCompactor];
  if (L.pos.x > R.pos.x + 400.0f) {
    L.vel.x = -L.vel.x;
    R.vel.x = -R.vel.x;
  }
  if (L.pos.x <= -L.Width) {
    L.vel.x = sim.opts.shapeDriftRate * 0.1f;
    R.vel.x = -sim.opts.shapeDriftRate * 0.1f;
  }
}

// Obstacles.bas:355-372 — DriftObstacles: 2 RNG por eje activo y por forma
// (Random(-rate, rate) y el factor Rndy*0.01). OJO: el "tope" está invertido
// en el fuente — re-escala por Magnitud/MaxVelocity (> 1), AMPLIFICANDO la
// velocidad que lo supere; se replica tal cual (los clamps ByRef de
// VectorScalar acotan a ±32000).
inline void DriftObstacles(Sim& sim) {
  for (int i = 1; i <= sim.numObstacles; ++i) {
    Obstacle& o = sim.Obstacles[i];
    if (o.exist && (i != sim.leftCompactor && i != sim.rightCompactor)) {
      if (sim.opts.allowHorizontalShapeDrift) {
        const vb_long r = Random(-sim.opts.shapeDriftRate,
                                 sim.opts.shapeDriftRate, *sim.rndy);
        o.vel.x = static_cast<vb_single>(
            static_cast<double>(o.vel.x) +
            static_cast<double>(r) * static_cast<double>(sim.rnd()) * 0.01);
      }
      if (sim.opts.allowVerticalShapeDrift) {
        const vb_long r = Random(-sim.opts.shapeDriftRate,
                                 sim.opts.shapeDriftRate, *sim.rndy);
        o.vel.y = static_cast<vb_single>(
            static_cast<double>(o.vel.y) +
            static_cast<double>(r) * static_cast<double>(sim.rnd()) * 0.01);
      }
      if (VectorMagnitude(o.vel) > sim.opts.MaxVelocity)
        o.vel = VectorScalar(o.vel, VectorMagnitude(o.vel) /
                                        sim.opts.MaxVelocity);
    }
  }
}

// Obstacles.bas:322-350 — MoveObstacles (paso 18): integra y acota al campo
// re-armando la velocidad hacia adentro (±shapeDriftRate*0.01).
inline void MoveObstacles(Sim& sim) {
  if (sim.opts.allowHorizontalShapeDrift || sim.opts.allowVerticalShapeDrift)
    DriftObstacles(sim);
  if (sim.leftCompactor > 0 || sim.rightCompactor > 0)
    TrashCompactorMove(sim);

  for (int i = 1; i <= sim.numObstacles; ++i) {
    Obstacle& o = sim.Obstacles[i];
    if (!o.exist) continue;
    o.pos = VectorAdd(o.pos, o.vel);
    if (o.pos.x < -o.Width) {
      o.pos.x = -o.Width;
      o.vel.x = sim.opts.shapeDriftRate * 0.01f;
    }
    if (o.pos.y < -o.Height) {
      o.pos.y = -o.Height;
      o.vel.y = sim.opts.shapeDriftRate * 0.01f;
    }
    if (o.pos.x > sim.opts.FieldWidth) {
      o.pos.x = sim.opts.FieldWidth;
      o.vel.x = -sim.opts.shapeDriftRate * 0.01f;
    }
    if (o.pos.y > sim.opts.FieldHeight) {
      o.pos.y = sim.opts.FieldHeight;
      o.vel.y = -sim.opts.shapeDriftRate * 0.01f;
    }
  }
}

// Obstacles.bas:376-397 — ObstacleCollision: AABB del bot (por radio)
// contra el rectángulo de la forma.
inline bool ObstacleCollision(Sim& sim, int n, int o) {
  const vb_single botrightedge = sim.rob[n].pos.x + sim.rob[n].radius;
  const vb_single botleftedge = sim.rob[n].pos.x - sim.rob[n].radius;
  const vb_single bottopedge = sim.rob[n].pos.y - sim.rob[n].radius;
  const vb_single botbottomedge = sim.rob[n].pos.y + sim.rob[n].radius;
  const Obstacle& ob = sim.Obstacles[o];
  return (botrightedge > ob.pos.x) && (botleftedge < ob.pos.x + ob.Width) &&
         (botbottomedge > ob.pos.y) && (bottopedge < ob.pos.y + ob.Height);
}

// Obstacles.bas:434-553 — DoObstacleCollisions (P1 de UpdateBots): empuja
// al bot por el borde más cercano (k = b = 0.5), alterna ejes vía LastPush,
// levanta touch en el lado del golpe y publica reftype = 1 si el bot no ve
// nada. Con 3+ colisiones en la pasada: salto anti-atrapamiento función del
// ciclo (Sgn de TotRunCycle Mod 40/50) y GoTo getout.
inline void DoObstacleCollisions(Sim& sim, int n) {
  int numofcollisions = 0;
  int LastPush = 0;
  const vb_single k = 0.5f;
  const vb_single bb = 0.5f;

  Bot& b = sim.rob[n];
  for (int i = 1; i <= sim.numObstacles; ++i) {
    if (!sim.Obstacles[i].exist) continue;
    if (!ObstacleCollision(sim, n, i)) continue;
    const Obstacle& ob = sim.Obstacles[i];

    numofcollisions += 1;
    if (numofcollisions >= 3) {
      // Prevents getting trapped
      b.pos.x = b.pos.x +
                200.0f * static_cast<vb_single>(vb_sgn(
                             sim.opts.TotRunCycle % 40 - 20));
      b.pos.y = b.pos.y +
                200.0f * static_cast<vb_single>(vb_sgn(
                             sim.opts.TotRunCycle % 50 - 25));
      return;  // GoTo getout
    }

    const vb_single distup = (b.pos.y + b.radius) - ob.pos.y;
    const vb_single distdown = ob.pos.y + ob.Height - (b.pos.y - b.radius);
    const vb_single distleft = (b.pos.x + b.radius) - ob.pos.x;
    const vb_single distright = ob.pos.x + ob.Width - (b.pos.x - b.radius);

    if ((Min(distleft, distright) < Min(distup, distdown) &&
         (LastPush != 1 && LastPush != 2)) ||
        (LastPush == 3 || LastPush == 4)) {
      // Push out left or right
      if (((distleft <= distright) ||
           (ob.pos.x + ob.Width) >= sim.opts.FieldWidth) &&
          (ob.pos.x > 0.0f)) {
        if (b.pos.x - b.radius < ob.pos.x) {
          b.pos.x = ob.pos.x - b.radius;
          b.ImpulseRes.x = b.ImpulseRes.x + b.vel.x * bb;
          touch(sim, n, b.pos.x + b.radius, b.pos.y);  // lado derecho
        } else {
          b.ImpulseRes.x = b.ImpulseRes.x + distleft * k;
          b.pos.x = ob.pos.x - b.radius;
        }
        LastPush = 1;
      } else {
        if (b.pos.x + b.radius > ob.pos.x + ob.Width) {
          b.pos.x = ob.pos.x + ob.Width + b.radius;
          b.ImpulseRes.x = b.ImpulseRes.x + b.vel.x * bb;
          touch(sim, n, b.pos.x - b.radius, b.pos.y);  // lado izquierdo
        } else {
          b.ImpulseRes.x = b.ImpulseRes.x - distright * k;
          b.pos.x = ob.pos.x + ob.Width + b.radius;
        }
        LastPush = 2;
      }
    } else {
      // Push out up or down
      if (((distup <= distdown) ||
           (ob.pos.y + ob.Height) >= sim.opts.FieldHeight) &&
          (ob.pos.y > 0.0f)) {
        if (b.pos.y - b.radius < ob.pos.y) {
          b.pos.y = ob.pos.y - b.radius;
          b.ImpulseRes.y = b.ImpulseRes.y + b.vel.y * bb;
          touch(sim, n, b.pos.x, b.pos.y + b.radius);  // abajo
        } else {
          b.ImpulseRes.y = b.ImpulseRes.y + distup * k;
          b.pos.y = ob.pos.y - b.radius;
        }
        LastPush = 3;
      } else {
        if (b.pos.y + b.radius > ob.pos.y + ob.Height) {
          b.pos.y = ob.pos.y + ob.Height + b.radius;
          b.ImpulseRes.y = b.ImpulseRes.y + b.vel.y * bb;
          touch(sim, n, b.pos.x, b.pos.y - b.radius);  // arriba ("bottom"
                                                       // en el comentario
                                                       // original, errado)
        } else {
          b.ImpulseRes.y = b.ImpulseRes.y - distdown * k;
          b.pos.y = ob.pos.y + ob.Height + b.radius;
        }
        LastPush = 4;
      }
    }

    // Si el bot no ve nada y tocó una forma, reftype = 1.
    if (LastPush > 0 && b.mem[addr::EYEF] == 0) b.mem[addr::REFTYPE] = 1;
  }
}

}  // namespace db
