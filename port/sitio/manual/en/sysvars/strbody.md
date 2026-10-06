---
titulo: .strbody
resumen: "Stores energy as body: up to 100 energy per cycle, which turns into 10 body."
etiquetas: [body, energy, action, conversion]
estado: revisada
---
<!-- 31-ENERGIA §0.3 (storebody, tope 100, sin mirar nrg); port/README A3-7 (negativos se borran); comprobado: con 5300 de energía sube 10 de cuerpo por ciclo hasta bajar a 5000 -->
Write how much energy you want to store and the engine converts it in the same cycle:
`100 .strbody store` subtracts 100 from [[.nrg]] and adds 10 to [[.body]]. It is the
inverse operation of [[.fdbody]]. Bots use it so as not to keep all their wealth in energy:
body makes the bot bigger and it can be recovered later.

Some details:

- **Cap of 100 per cycle.** A larger value counts as 100.
- **It is cleared when used**, so you have to write it every cycle in which you
  want it. Negatives do nothing: the engine clears them without converting (in the
  original DarwinBots they stayed written; the port fixed that).
- **It doesn't check how much energy you have.** With 50 energy, `100 .strbody store` charges
  the full 100 anyway: the bot ends up with no energy and dies. Always put a condition on
  `*.nrg`.
- **Body doesn't go past 32000.** Above that, the energy is charged and the body doesn't
  grow.

```adn
' With energy to spare, it stores it in the body
cond
 *.nrg 4000 >
start
 100 .strbody store
stop
```

This bot drops 100 energy and gains 10 body per cycle as long as it has more than
4000. The complete piggy-bank example, with both orders, is in
[[sysvars/cuerpo]].
