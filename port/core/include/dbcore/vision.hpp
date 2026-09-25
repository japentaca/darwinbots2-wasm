// dbcore/vision.hpp — Quads.bas (porción de visión): los 9 ojos apuntables y
// ensanchables (CompareRobots3), el barrido (BucketsProximity) y la oclusión
// por formas rota dos veces (ShapeBlocksBot, [PROBABLE BUG] B2-1).
// Contratos: 32-VISION.md; casos F-08..F-11, F-14, B-12..B-14.
// CompareShapes (visión DE formas, Quads.bas:597-943) transcrita en M6 con
// SegmentSegmentIntersect (la versión correcta, Quads.bas:947-963).
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
  // Single * 0.8 (literal Double): un redondeo (RV-29).
  if (!sim.opts.Daytime) es = static_cast<vb_single>(static_cast<double>(es) * 0.8);
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

// Quads.bas:476-497, 790-801 — ángulo de un vector (Y ya invertida) con la
// protección de x = 0. `Atn(y / x)` se asigna a Single; en el cuadrante
// izquierdo `Atn(y / x) + PI` es Double + Single y se redondea UNA vez
// (RV-29). La división va en double (N-06).
inline vb_single view_angle(const Vector& v) {
  if (v.x == 0.0f) return (v.y > 0.0f) ? PI / 2 : 3 * PI / 2;
  const double at =
      std::atan(static_cast<double>(v.y) / static_cast<double>(v.x));
  if (v.x > 0.0f) return static_cast<vb_single>(at);
  return static_cast<vb_single>(at + static_cast<double>(PI));
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
  if (BaseHidden(sim, sim.rob[n2])) return;  // E5 (Quads.bas:402)
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
  vb_single theta = view_angle(ad);
  vb_single beta = view_angle(ac);

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

// Quads.bas:947-963 — SegmentSegmentIntersect: la versión CORRECTA (s y t
// ambos en [0,1]; compárese con ShapeBlocksBot). Devuelve s o 0.
inline vb_single SegmentSegmentIntersect(const Vector& P0, const Vector& D0,
                                         const Vector& P1, const Vector& D1) {
  const vb_single dotPerp = D0.x * D1.y - D1.x * D0.y;
  if (dotPerp != 0.0f) {
    const Vector Delta = VectorSub(P1, P0);
    const vb_single s =
        Dot(Delta, VectorSet(D1.y, -D1.x)) / dotPerp;
    const vb_single t =
        Dot(Delta, VectorSet(D0.y, -D0.x)) / dotPerp;
    if (s >= 0.0f && s <= 1.0f && t >= 0.0f && t <= 1.0f) return s;
  }
  return 0.0f;
}

// Quads.bas:597-943 — CompareShapes: visión DE formas (solo con
// shapesAreVisable). Transcripción literal, con sus [PROBABLE BUG]:
//  - B2-3 (B-12): "bot dentro de la forma" sale con GoTo getout sin tocar
//    EYEF (los 9 ojos a 32000, lastopp/lastopptype sí).
//  - B2-4 (B-13): lastopppos solo se captura cuando a = 4 (ojo frontal); con
//    focuseye != 0 los refvars de posición salen de (0,0) u obsoletos.
//  - B2-5 (B-14): halfeyewidth = (eyeXwidth + 35)/400 normalizado a [0, PI]
//    con PI enteros — fórmula DISTINTA a la de bots (Mod 1256 + PI/36).
//  - distleft/distright/dist NO se resetean entre los hasta 2 lados que un
//    bot en esquina evalúa (solo por ojo) — fiel al fuente.
// robfocus/eyeDistance (UI de depuración) quedan fuera del core.
inline void CompareShapes(Sim& sim, int n, int /*field*/) {
  Bot& b = sim.rob[n];

  // Local del fuente, UNO por llamada: arranca en (0,0) y persiste entre
  // formas y ojos; solo el bucle con a = 4 lo escribe (B-13).
  Vector lastopppos{};

  const vb_single sightdist =
      EyeSightDistance(sim, NarrowestEye(sim, n), n) + b.radius;

  for (int o = 1; o <= sim.numObstacles; ++o) {
    if (!sim.Obstacles[o].exist) continue;
    const Obstacle& ob = sim.Obstacles[o];

    // Weed-out barato: la forma entera fuera del alcance del ojo más ancho.
    if (ob.pos.x > b.pos.x + sightdist ||
        ob.pos.x + ob.Width < b.pos.x - sightdist ||
        ob.pos.y > b.pos.y + sightdist ||
        ob.pos.y + ob.Height < b.pos.y - sightdist) {
      // demasiado lejos; siguiente forma
    } else if (ob.pos.x < b.pos.x && ob.pos.x + ob.Width > b.pos.x &&
               ob.pos.y < b.pos.y && ob.pos.y + ob.Height > b.pos.y) {
      // ¡Bot dentro de la forma! GoTo getout: EYEF queda rancio (B-12).
      for (int i = 0; i <= 8; ++i) b.mem[addr::EyeStart + 1 + i] = 32000;
      b.lastopp = o;
      b.lastopptype = 1;
      return;  // getout
    } else {
      // Los cuatro lados (esta vez SIN transponer, a diferencia de
      // ShapeBlocksBot) y las cuatro esquinas.
      Vector D1[5];
      Vector p[5];
      D1[1] = VectorSet(ob.Width, 0);   // top
      D1[2] = VectorSet(0, ob.Height);  // left side
      D1[3] = D1[1];                    // bottom
      D1[4] = D1[2];                    // right side

      p[1] = ob.pos;                       // NW
      p[2] = p[1];
      p[2].y = p[1].y + ob.Height;         // SW
      p[3] = VectorAdd(p[1], D1[1]);       // NE
      p[4] = VectorAdd(p[2], D1[1]);       // SE

      const Vector P0 = b.pos;

      // Clasificación en 8 sectores (N/E/S/O y diagonales). nearestCorner
      // del fuente es una asignación muerta (nunca se lee); no se replica.
      int botLocation;
      if (P0.x < p[1].x) {
        botLocation = 4;  // West
        if (P0.y < p[1].y)
          botLocation = 8;  // NW
        else if (P0.y > p[2].y)
          botLocation = 7;  // SW
      } else if (P0.x > p[3].x) {
        botLocation = 2;  // East
        if (P0.y < p[1].y)
          botLocation = 5;  // NE
        else if (P0.y > p[2].y)
          botLocation = 6;  // SE
      } else if (P0.y < p[1].y) {
        botLocation = 1;  // North
      } else {
        botLocation = 3;  // South
      }

      for (int a = 0; a <= 8; ++a) {
        const vb_single eyedist = EyeSightDistance(
            sim, AbsoluteEyeWidth(b.mem[addr::EYE1WIDTH + a]), n);

        // Weed-out por ojo.
        if (ob.pos.x > b.pos.x + eyedist ||
            ob.pos.x + ob.Width < b.pos.x - eyedist ||
            ob.pos.y > b.pos.y + eyedist ||
            ob.pos.y + ob.Height < b.pos.y - eyedist)
          continue;

        vb_single eyeaim = static_cast<vb_single>(
            static_cast<double>(b.mem[addr::EYE1DIR + a] % 1256) / 200.0 -
            (static_cast<double>(PI) / 18.0) * a +
            (static_cast<double>(PI) / 18.0) * 4.0 +
            static_cast<double>(b.aim));
        while (eyeaim > 2 * PI) eyeaim = eyeaim - 2 * PI;
        while (eyeaim < 0.0f) eyeaim = eyeaim + 2 * PI;

        // B-14: fórmula de semiancho DISTINTA a la de bots.
        vb_single halfeyewidth = static_cast<vb_single>(
            (static_cast<double>(b.mem[addr::EYE1WIDTH + a]) + 35.0) / 400.0);
        while (halfeyewidth > PI) halfeyewidth = halfeyewidth - PI;
        while (halfeyewidth < 0.0f) halfeyewidth = halfeyewidth + PI;
        vb_single eyeaimleft = eyeaim + halfeyewidth;
        vb_single eyeaimright = eyeaim - halfeyewidth;

        if (eyeaimright < 0.0f) eyeaimright = 2 * PI + eyeaimright;
        if (eyeaimleft > 2 * PI) eyeaimleft = eyeaimleft - 2 * PI;
        const bool eyespanszero = (eyeaimleft < eyeaimright);

        // Bordes del ojo como vectores escalados al alcance (Y invertida:
        // cuadrante 4).
        Vector eyeaimleftvector = VectorSet(
            static_cast<vb_single>(std::cos(static_cast<double>(eyeaimleft))),
            static_cast<vb_single>(std::sin(static_cast<double>(eyeaimleft))));
        {
          Vector u = VectorUnit(eyeaimleftvector);
          eyeaimleftvector = VectorScalar(u, eyedist);
        }
        Vector eyeaimrightvector = VectorSet(
            static_cast<vb_single>(std::cos(static_cast<double>(eyeaimright))),
            static_cast<vb_single>(std::sin(static_cast<double>(eyeaimright))));
        {
          Vector u = VectorUnit(eyeaimrightvector);
          eyeaimrightvector = VectorScalar(u, eyedist);
        }
        eyeaimleftvector.y = -eyeaimleftvector.y;
        eyeaimrightvector.y = -eyeaimrightvector.y;

        vb_single distleft = 0.0f;
        vb_single distright = 0.0f;
        vb_single dist = 32000.0f;
        vb_single lowestDist = 32000.0f;

        // Punto más cercano de la forma (esquina o pie de perpendicular).
        Vector closestPoint{};
        switch (botLocation) {
          case 1: closestPoint = P0; closestPoint.y = p[1].y; break;  // N
          case 2: closestPoint = P0; closestPoint.x = p[4].x; break;  // E
          case 3: closestPoint = P0; closestPoint.y = p[4].y; break;  // S
          case 4: closestPoint = P0; closestPoint.x = p[1].x; break;  // W
          case 5: closestPoint = p[3]; break;  // NE
          case 6: closestPoint = p[4]; break;  // SE
          case 7: closestPoint = p[2]; break;  // SW
          case 8: closestPoint = p[1]; break;  // NW
        }

        Vector ab = VectorSub(closestPoint, P0);
        ab.y = -ab.y;

        vb_single theta = angnorm(view_angle(ab));

        if ((eyeaimleft >= theta && theta >= eyeaimright && !eyespanszero) ||
            (eyeaimleft >= theta && eyespanszero) ||
            (eyeaimright <= theta && eyespanszero)) {
          lowestDist = VectorMagnitude(ab);
          if (a == 4) lastopppos = closestPoint;  // B-13: solo a = 4
        }

        if (lowestDist == 32000.0f) {
          // El ojo no abarca el punto más cercano: intersectar los bordes
          // del ojo con los (1 o 2) lados visibles de la forma.
          auto check_side = [&](const Vector& pc, const Vector& dc) {
            const vb_single s =
                SegmentSegmentIntersect(P0, eyeaimleftvector, pc, dc);
            if (s > 0.0f) distleft = s * VectorMagnitude(eyeaimleftvector);
            const vb_single t =
                SegmentSegmentIntersect(P0, eyeaimrightvector, pc, dc);
            if (t > 0.0f) distright = t * VectorMagnitude(eyeaimrightvector);
            if (distleft > 0.0f && distright > 0.0f)
              dist = Min(distleft, distright);
            else if (distleft > 0.0f)
              dist = distleft;
            else if (distright > 0.0f)
              dist = distright;
            if (dist > 0.0f && dist < lowestDist) {
              lowestDist = dist;
              if (a == 4) {
                if (distleft < distright && distleft > 0.0f) {
                  Vector u = VectorUnit(eyeaimleftvector);
                  Vector sc = VectorScalar(u, dist);
                  lastopppos = VectorAdd(b.pos, sc);
                } else {
                  Vector u = VectorUnit(eyeaimrightvector);
                  Vector sc = VectorScalar(u, dist);
                  lastopppos = VectorAdd(b.pos, sc);
                }
              }
            }
          };

          if (botLocation == 1 || botLocation == 5 || botLocation == 8)
            check_side(p[1], D1[1]);  // North: top
          if (botLocation == 2 || botLocation == 5 || botLocation == 6)
            check_side(p[3], D1[4]);  // East: right side
          if (botLocation == 3 || botLocation == 6 || botLocation == 7)
            check_side(p[2], D1[3]);  // South: bottom
          if (botLocation == 4 || botLocation == 7 || botLocation == 8)
            check_side(p[1], D1[2]);  // West: left side
        }

        if (lowestDist < 32000.0f) {
          const vb_single percentdist =
              (lowestDist - b.radius + 10.0f) / eyedist;
          vb_single eyevalue;
          if (percentdist <= 0.0f)
            eyevalue = 32000.0f;
          else
            eyevalue = 1.0f / (percentdist * percentdist);
          if (eyevalue > 32000.0f) eyevalue = 32000.0f;

          if (b.mem[addr::EyeStart + 1 + a] < eyevalue) {
            if (a == FocusEyeIndex(b.mem[addr::FOCUSEYE])) {
              b.lastopp = o;
              b.lastopptype = 1;
              b.mem[addr::EYEF] = vb_cint(eyevalue);
              b.lastopppos = lastopppos;
            }
            b.mem[addr::EyeStart + 1 + a] = vb_cint(eyevalue);
          }
        }
      }
    }
  }
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
