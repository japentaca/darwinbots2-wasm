---
titulo: .fixang
resumen: "Command that fixes the angle of a stiffened tie relative to where the bot is pointing (on the scale of 1256 per turn); a negative releases it."
etiquetas: [ties, tie, multicellular, angle]
estado: revisada
---
Fixes the direction, seen from the bot, in which the tie chosen with
[[.tienum]] (or the one in [[.tiepres]]) has to sit. The scale is the usual one:
0 is straight ahead, 314 a quarter turn, 628 behind, and values are taken modulo
1256. From that cycle on the engine turns the bot and pushes the two sideways to
hold that angle, like a joint. It leaves a slack of 5 degrees (about 17 on the
1256 scale) uncorrected, so the actual angle ends up close to the requested one
but not exact. A negative value releases the angle and the tie goes back to
turning freely.

<!-- sysvars.yaml .fixang (≥ 0 fija ángulo Mod 1256 /200; < 0 libera); 30-FISICA §3.2 (TieTorque, holgura de 5°); comprobado con probar-adn: con 314 el lazo se sostiene en ~333 -->

It only acts on stiffened ties of a multicellular bot ([[.multi]]). When a tie
stiffens, the tie of the bot that created it is already fixed at the angle it
had at that moment; `.fixang` is for changing it.

<!-- 34-TIES §0.4 (regang fija el ángulo actual; solo el lado no-back) -->

Its resting value is **32000**, not 0: the bot is born with 32000 and the engine
sets it back to 32000 after using it. Writing 0 is not “nothing”, it is “the tie
straight ahead”. If the bot has no ties, the value you write just stays there.

<!-- 21-MEMORIA §9.8 (centinela 32000; reset tras el gate tienum/tiepres) -->

```adn
' once multicellular, bring the partner to one side
cond
*.multi 1 =
start
314 .fixang store
stop
```

To handle the first four ties without choosing them one by one there are
[[.tieang1]]…`.tieang4`.
