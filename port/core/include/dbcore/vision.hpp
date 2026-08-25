// dbcore/vision.hpp — Quads.bas (porción de visión): los 9 ojos apuntables y
// ensanchables (CompareRobots3), el barrido (BucketsProximity) y la oclusión
// por formas rota dos veces (ShapeBlocksBot, [PROBABLE BUG] B2-1).
// Contratos: 32-VISION.md; casos F-08..F-11, F-14.
// CompareShapes (visión DE formas, Quads.bas:597-943) queda como stub
// registrado: solo corre con shapesAreVisable (default false del harness).
#pragma once

#include "buckets.hpp"
#include "sim.hpp"

namespace db {

// Quads.bas:350-357 — AbsoluteEyeWidth (Integer de 16 bits en todo el camino).
inline vb_integer AbsoluteEyeWidth(vb_integer Width) {
  if (Width == 0) return 35;
  vb_integer r = static_cast<vb_integer>(Width % 1256 + 35);
  if (r <= 0) r = static_cast<vb_integer>(1256 + r);
  return r;
}

// Quads.bas:361-370 — NarrowestEye: arranca en el techo 1221.
inline vb_integer NarrowestEye(Sim& sim, int n) {
  vb_integer narrowest = 1221;
  for (int i = 0; i <= 8; ++i) {
    const vb_integer w =
        AbsoluteEyeWidth(sim.rob[n].mem[addr::EYE1WIDTH + i]);
    if (w < narrowest) narrowest = w;
  }
  return narrowest;
}

// Quads.bas:383-397 — eyestrength: atenúa por profundidad en pondmode y x0.8
// de noche; clampa a <= 1 (nunca amplifica).
inline vb_single eyestrength(Sim& sim, int n1) {
  constexpr double EyeEffectiveness = 3.0;  // Quads.bas:384
  vb_single es;
  if (sim.opts.Pondmode && sim.rob[n1].pos.y > 1.0f) {
    es = static_cast<vb_single>(std::pow(
        EyeEffectiveness /
            std::pow(static_cast<double>(sim.rob[n1].pos.y) / 2000.0,
                     static_cast<double>(sim.opts.Gradient)),
        6828.0 / static_cast<double>(sim.opts.FieldHeight)));
  } else {
    es = 1.0f;
  }
  if (!sim.opts.Daytime) es = es * 0.8f;
  if (es > 1.0f) es = 1.0f;
  return es;
}

// Quads.bas:375-381 — EyeSightDistance: 1440*(1 - Log(w/35)/4)*eyestrength.
inline vb_single EyeSightDistance(Sim& sim, vb_integer w, int n1) {
  if (w == 35) return 1440.0f * eyestrength(sim, n1);
  return static_cast<vb_single>(
      1440.0 * (1.0 - std::log(static_cast<double>(w) / 35.0) / 4.0) *
      static_cast<double>(eyestrength(sim, n1)));
}

// Quads.bas:566-572 — el valor de ojo: 1/percentdist^2 con clamp 32000;
// solape físico (edgetoedgedist <= 0) => 32000 directo (F-10).
inline vb_single eyevalue_from_dist(vb_single edgetoedgedist,
                                    vb_single eyedist) {
  if (edgetoedgedist <= 0.0f) return 32000.0f;
  const vb_single percentdist = (edgetoedgedist + 10.0f) / eyedist;
  vb_single ev = 1.0f / (percentdist * percentdist);
  if (ev > 32000.0f) ev = 32000.0f;
  return ev;
}

// Quads.bas:578 — mapeo del ojo con foco: Abs(focuseye + 4) Mod 9 pliega los
// negativos lejanos de forma no monótona (F-10).
inline int FocusEyeIndex(vb_integer focuseye) {
  return std::abs(static_cast<int>(focuseye) + 4) % 9;
}

// Quads.bas:290-344 — ShapeBlocksBot. [PROBABLE BUG] B2-1 replicado
// literalmente: los vectores de borde están TRANSPUESTOS ("top" = (0, Width),
// "left" = (Height, 0)) y el criterio de corte es `useT Or useS` — basta que
// UNA paramétrica caiga en [0,1] para declarar bloqueada la línea de visión.
inline bool ShapeBlocksBot(Sim& sim, int n1, int n2, int o) {
  const Obstacle& ob = sim.Obstacles[o];

  // Weed-out AABB (correcto).
  if (ob.pos.x > Max(sim.rob[n1].pos.x, sim.rob[n2].pos.x) ||
      ob.pos.x + ob.Width < Min(sim.rob[n1].pos.x, sim.rob[n2].pos.x) ||
      ob.pos.y > Max(sim.rob[n1].pos.y, sim.rob[n2].pos.y) ||
      ob.pos.y + ob.Height < Min(sim.rob[n1].pos.y, sim.rob[n2].pos.y))
    return false;

  Vector D1[5];
  Vector p[5];
  D1[1] = VectorSet(0, ob.Width);   // "top" — transpuesto
  D1[2] = VectorSet(ob.Height, 0);  // "left side" — transpuesto
  D1[3] = D1[1];                    // bottom
  D1[4] = D1[2];                    // right side

  p[1] = ob.pos;
  p[2] = p[1];
  p[3] = VectorAdd(p[1], D1[2]);
  p[4] = VectorAdd(p[1], D1[1]);

  const Vector P0 = sim.rob[n1].pos;
  const Vector D0 = VectorSub(sim.rob[n2].pos, sim.rob[n1].pos);
  for (int i = 1; i <= 4; ++i) {
    const vb_single numerator = Cross(D0, D1[i]);
    if (numerator != 0.0f) {
      const Vector Delta = VectorSub(p[i], P0);
      const vb_single s = Cross(Delta, D1[i]) / numerator;
      const vb_single t = Cross(Delta, D0) / numerator;

      bool useT = false;
      bool useS = false;
      if (t >= 0.0f && t <= 1.0f) useT = true;
      if (s >= 0.0f && s <= 1.0f) useS = true;

      if (useT || useS) return true;  // el `Or` del fuente (Quads.bas:335)
    }
  }
  return false;
}

// Quads.bas:274-288 — AnyShapeBlocksBot.
inline bool AnyShapeBlocksBot(Sim& sim, int n1, int n2) {
  for (int i = 1; i <= sim.numObstacles; ++i) {
    if (sim.Obstacles[i].exist && ShapeBlocksBot(sim, n1, n2, i)) return true;
  }
  return false;
}

// Quads.bas:401-592 — CompareRobots3: visión de bots con 9 ojos apuntables.
// Transcripción literal (el test de visibilidad de 10 cláusulas se replica
// tal cual, 32-VISION.md §2.5). hidepred: capa torneo ⚙, fuera.
inline void CompareRobots3(Sim& sim, int n1, int n2) {
  Bot& b1 = sim.rob[n1];
  const Bot& b2 = sim.rob[n2];

  Vector ab = VectorSub(b2.pos, b1.pos);
  const vb_single edgetoedgedist =
      VectorMagnitude(ab) - b1.radius - b2.radius;

  // Filtro grueso: el ojo más estrecho, con atajo si las 9 anchuras están a 0.
  vb_long eyesum = 0;
  for (int i = 0; i <= 8; ++i)
    eyesum += static_cast<vb_long>(b1.mem[addr::EYE1WIDTH + i]);
  vb_single sightdist;
  if (eyesum == 0)
    sightdist = 1440.0f * eyestrength(sim, n1);
  else
    sightdist = EyeSightDistance(sim, NarrowestEye(sim, n1), n1);

  if (edgetoedgedist > sightdist) return;  // demasiado lejos

  if (!sim.opts.shapesAreSeeThrough) {
    if (AnyShapeBlocksBot(sim, n1, n2)) return;
  }

  const vb_single invdist = VectorInvMagnitude(ab);

  // ac y ad apuntan a los bordes del bot observado; ab al centro.
  Vector ac = VectorScalar(ab, invdist);  // unit (clamp ByRef inofensivo)
  Vector ad = VectorSet(ac.y, -ac.x);
  ad = VectorScalar(ad, b2.radius);
  ad = VectorAdd(ab, ad);

  ac = VectorSet(-ac.y, ac.x);
  ac = VectorScalar(ac, b2.radius);
  ac = VectorAdd(ab, ac);

  // Cuadrante 4: la Y se invierte para que la trigonometría funcione.
  ad.y = -ad.y;
  ac.y = -ac.y;

  // theta = ángulo al borde izquierdo; beta = al derecho.
  vb_single theta, beta;
  if (ad.x == 0.0f) {
    theta = (ad.y > 0.0f) ? PI / 2 : 3 * PI / 2;
  } else {
    theta = static_cast<vb_single>(
        std::atan(static_cast<double>(ad.y) / static_cast<double>(ad.x)));
    if (ad.x < 0.0f) theta = theta + PI;
  }
  if (ac.x == 0.0f) {
    beta = (ac.y > 0.0f) ? PI / 2 : 3 * PI / 2;
  } else {
    beta = static_cast<vb_single>(
        std::atan(static_cast<double>(ac.y) / static_cast<double>(ac.x)));
    if (ac.x < 0.0f) beta = beta + PI;
  }

  if (theta < 0.0f) theta = theta + 2 * PI;
  if (beta < 0.0f) beta = beta + 2 * PI;

  const bool botspanszero = (beta > theta);

  for (int a = 0; a <= 8; ++a) {
    vb_single eyedist;
    if (b1.mem[addr::EYE1WIDTH + a] == 0)
      eyedist = 1440.0f * eyestrength(sim, n1);
    else
      eyedist = EyeSightDistance(
          sim, AbsoluteEyeWidth(b1.mem[addr::EYE1WIDTH + a]), n1);
    if (edgetoedgedist <= eyedist) {
      // Dirección del ojo relativa a .aim (eye5 = frontal; índices bajos a
      // la izquierda). aim puede venir sin normalizar (30-FISICA.md §7).
      vb_single eyeaim = static_cast<vb_single>(
          static_cast<double>(b1.mem[addr::EYE1DIR + a] % 1256) / 200.0 -
          (static_cast<double>(PI) / 18.0) * a +
          (static_cast<double>(PI) / 18.0) * 4.0 +
          static_cast<double>(b1.aim));
      while (eyeaim > 2 * PI) eyeaim = eyeaim - 2 * PI;
      while (eyeaim < 0.0f) eyeaim = eyeaim + 2 * PI;

      // Semiancho: anchuras negativas (Mod 1256 conserva el signo) suben por
      // +PI hasta (-PI/36, PI - PI/36] => ojo casi panorámico ([PROBABLE BUG]
      // B2-2, F-11).
      vb_single halfeyewidth = static_cast<vb_single>(
          static_cast<double>(b1.mem[addr::EYE1WIDTH + a] % 1256) / 400.0);
      while (halfeyewidth > PI - PI / 36)
        halfeyewidth = halfeyewidth - PI;
      while (halfeyewidth < -PI / 36) halfeyewidth = halfeyewidth + PI;
      vb_single eyeaimleft = eyeaim + halfeyewidth + PI / 36;
      vb_single eyeaimright = eyeaim - halfeyewidth - PI / 36;

      if (eyeaimright < 0.0f) eyeaimright = 2 * PI + eyeaimright;
      if (eyeaimleft > 2 * PI) eyeaimleft = eyeaimleft - 2 * PI;
      const bool eyespanszero = (eyeaimleft < eyeaimright);

      // La disyunción de 10 cláusulas, transcrita literalmente.
      if ((eyeaimleft >= theta && theta >= eyeaimright && !eyespanszero) ||
          (eyeaimleft >= theta && eyespanszero) ||
          (eyeaimright <= theta && eyespanszero) ||
          (eyeaimleft >= beta && beta >= eyeaimright && !eyespanszero) ||
          (eyeaimleft >= beta && eyespanszero) ||
          (eyeaimright <= beta && eyespanszero) ||
          (eyeaimleft <= theta && beta <= eyeaimright && !eyespanszero &&
           !botspanszero) ||
          (eyeaimleft <= theta && !eyespanszero && botspanszero) ||
          (eyeaimright >= beta && !eyespanszero && botspanszero) ||
          (eyeaimleft <= theta && eyeaimright >= beta && eyespanszero &&
           botspanszero)) {
        const vb_single eyevalue =
            eyevalue_from_dist(edgetoedgedist, eyedist);

        if (b1.mem[addr::EyeStart + 1 + a] < eyevalue) {
          if (a == FocusEyeIndex(b1.mem[addr::FOCUSEYE])) {
            b1.lastopp = n2;
            b1.mem[addr::EYEF] = vb_cint(eyevalue);
          }
          b1.mem[addr::EyeStart + 1 + a] = vb_cint(eyevalue);
        }
      }
    }
  }
}

// Quads.bas:597-943 — CompareShapes: visión DE formas. Stub registrado
// (decisión de port M4): solo corre con shapesAreVisable, default false del
// harness; su transcripción llega con los casos B2-3/B2-4 del catálogo §9.
inline void CompareShapes(Sim& sim, int n, int /*field*/) {
  (void)n;
  sim.diag.shapes_vision_stub += 1;
}

// Quads.bas:207-221 — CheckBotBucketForVision.
inline void CheckBotBucketForVision(Sim& sim, int n, const Vector& pos) {
  BucketType& bk = BucketAt(sim, static_cast<int>(pos.x),
                            static_cast<int>(pos.y));
  if (bk.size == 0) return;
  int a = 1;
  while (bk.arr[a] != -1) {
    const int robnumber = bk.arr[a];
    if (robnumber != n) CompareRobots3(sim, n, robnumber);
    if (a == bk.size) return;
    a += 1;
  }
}

// Quads.bas:174-205 — BucketsProximity: resetea lastopp/EYEF/ojos y barre la
// celda propia + hasta 8 adyacentes; formas al final si son visibles.
inline int BucketsProximity(Sim& sim, int n) {
  EnsureBuckets(sim);
  // Defensivo: un bot jamás llega aquí sin bucket (todas las vías de alta
  // pasan por UpdateBotBucket); si pasara, el original indexaría fuera de la
  // rejilla (error 9). Se re-registra en vez de truncar.
  if (sim.rob[n].BucketPos.x < 0 || sim.rob[n].BucketPos.y < 0)
    UpdateBotBucket(sim, n);
  const Vector BucketPos = sim.rob[n].BucketPos;
  sim.rob[n].lastopp = 0;
  sim.rob[n].lastopptype = 0;
  sim.rob[n].mem[addr::EYEF] = 0;
  for (int x = addr::EyeStart + 1; x <= addr::EyeEnd - 1; ++x)
    sim.rob[n].mem[x] = 0;

  CheckBotBucketForVision(sim, n, BucketPos);

  for (int x = 1; x <= 8; ++x) {
    const Vector adjBucket =
        BucketAt(sim, static_cast<int>(BucketPos.x),
                 static_cast<int>(BucketPos.y))
            .adjBucket[x];
    if (adjBucket.x != -1.0f)
      CheckBotBucketForVision(sim, n, adjBucket);
    else
      break;
  }

  if (sim.opts.shapesAreVisable && sim.rob[n].exist) CompareShapes(sim, n, 12);

  return static_cast<int>(sim.rob[n].lastopp);
}

}  // namespace db
