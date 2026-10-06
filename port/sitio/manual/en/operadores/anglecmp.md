---
titulo: anglecmp
resumen: "Compares two angles and gives the shortest difference between them, signed, between −628 and 628: how much and which way to turn."
etiquetas: [geometry, angle, turning, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (anglecmp: Mod 1256 a [0,1255], AngDiff·200 en ±628); core common.hpp AngDiff (a − b); comprobado en el port -->

`a b anglecmp` leaves the difference `a − b` between two angles, but by the
short way around: between −628 and 628 (half a turn in each direction). The
angles are in the units of [[.aim]], where 1256 is a full turn, and before
being compared they are brought into that range, so `1300` and `44` are the
same angle.

| `a b anglecmp` | Result |
|---|---|
| `300 100` | 200 |
| `100 300` | −200 |
| `100 1200` | 157 (the short way) |
| `0 628` | −628 |

A positive result means that `a` is to the left of `b` (counterclockwise).
That is why `target *.aim anglecmp` is exactly how much to turn left with
[[.aimsx]] to face the target; if it comes out negative, the turn goes the
other way. This bot orients itself downward (942):

```adn
cond
start
  942 *.aim anglecmp .aimsx store
stop
```

In the first cycle `*.aim` still reads 0, so the bot overshoots; in the
second it already corrects and ends up facing 942. To ask only whether it is
already pointing roughly right, use the absolute value:
`942 *.aim anglecmp abs 20 <`.

[[op:angle]] gives the angle toward a point, and it is the natural companion
of `anglecmp`.
