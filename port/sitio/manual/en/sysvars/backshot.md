---
titulo: .backshot
resumen: "With a value other than 0, the next shot goes out backward instead of forward."
etiquetas: [shots, aiming, action]
estado: revisada
---
<!-- 33-SHOTS §2.2; sysvars.yaml 900; core shots.hpp newshot (aim - PI; aimshoot pisa la dirección); probado: back.txt (no le pega al blanco de enfrente), persistencia con --set -->
If `.backshot` is anything other than 0 when a shot goes out, the
shot comes out of your back, in the direction opposite to [[.aim]], instead of
the front. It's useful for fleeing while shooting, or for defending your rear
without having to turn.

```adn
' something is following me: I run and shoot backward
cond
*.shdn 0 !=
start
30 .up store
1 .backshot store
-1 .shoot store
stop
```

A few details:

- It is consumed by the shot: the engine sets it back to 0 when a shot goes out. If
  you write it and don't shoot, it stays set until the next shot.
- If you also wrote [[.aimshoot]], `.aimshoot` wins, since it offsets the shot
  from your front; `.backshot` is cleared anyway, with no effect.
- The shot still goes out with the usual small random deviation (see
  [[.shoot]]).

In testing, a bot that saw its target straight ahead and shot with
`.backshot` never hit it.
