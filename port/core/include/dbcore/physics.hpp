// dbcore/physics.hpp — la porción de Physics.bas que M3 necesita: NetForces
// con VoluntaryForces completa (M-02), UpdatePosition (Robots.bas:826-879) y
// la cola sensorial de Repel3 (touch/lasttch/lookoccurr, M-01). La respuesta
// de impulso de colisión, bordercolls y las fuerzas de muelle/torque de ties
// son del milestone de física (F-*): stubs registrados en SimDiag.
#pragma once

#include "senses.hpp"
#include "sim.hpp"

namespace db {

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

// Physics.bas:121-156 — SphereDragForces (Density = 0 => sin efecto).
inline void SphereDragForces(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if ((b.vel.x == 0.0f && b.vel.y == 0.0f) || sim.opts.Density == 0.0f) return;
  // El cuerpo (SphereCd/Reynolds) llega con la física (F-*); con los defaults
  // del harness (Density = 0) este camino no se ejecuta.
  sim.diag.bordercolls_stub += 1;
}

// Physics.bas:385-407 — GravityForces (sin pondmode: impulso (0, Ygravity*masa)).
inline void GravityForces(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (sim.opts.Ygravity == 0.0f || !sim.opts.Pondmode ||
      sim.opts.Updnconnected) {
    b.ImpulseInd =
        VectorAdd(b.ImpulseInd, VectorSet(0.0f, sim.opts.Ygravity * b.mass));
  } else {
    // Rama de flotación con coste (pondmode) — B1/F-*.
    sim.diag.bordercolls_stub += 1;
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
    // UpdateBotBucket n — los buckets llegan con la visión/colisiones reales.
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

// La cola sensorial de Repel3 (Physics.bas:955-973): touch en ambos,
// lasttch cruzado, lookoccurr cruzado. La respuesta de impulso (V1f/V2f)
// es del milestone de física; aquí solo los efectos de memoria (M-01).
inline void Repel3Senses(Sim& sim, int rob1, int rob2) {
  touch(sim, rob1, sim.rob[rob2].pos.x, sim.rob[rob2].pos.y);
  touch(sim, rob2, sim.rob[rob1].pos.x, sim.rob[rob1].pos.y);
  sim.rob[rob1].lasttch = rob2;
  sim.rob[rob2].lasttch = rob1;
  lookoccurr(sim, rob1, rob2);
  lookoccurr(sim, rob2, rob1);
}

// Pasada de colisiones bot-bot simplificada (el original es BucketsCollision,
// Quads.bas:239-270: cada par una vez, con el bucle en el índice MENOR).
// Decisión de port (M3): solape de círculos por fuerza bruta manteniendo la
// regla del par único y el orden por índice; buckets y Repel3 completo con
// la física (F-*).
inline void BucketsCollisionSimple(Sim& sim, int t) {
  if (!sim.rob[t].exist) return;
  for (int j = t + 1; j <= sim.MaxRobs; ++j) {
    if (!sim.rob[j].exist) continue;
    const vb_single dx = sim.rob[t].pos.x - sim.rob[j].pos.x;
    const vb_single dy = sim.rob[t].pos.y - sim.rob[j].pos.y;
    const vb_single rr = sim.rob[t].radius + sim.rob[j].radius;
    if (dx * dx + dy * dy < rr * rr) {
      sim.diag.bot_collision_simplified += 1;
      Repel3Senses(sim, t, j);
    }
  }
}

}  // namespace db
