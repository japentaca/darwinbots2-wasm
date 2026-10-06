---
titulo: .fdbody
resumen: "Converts body into energy: up to 100 energy per cycle, at 10 energy per body point."
etiquetas: [body, energy, action, conversion]
estado: revisada
---
<!-- 31-ENERGIA §0.3 (feedbody, tope 100); port/README A3-7 (negativos se borran) -->
Write how much energy you want to take out of the body and the engine converts
it in the same cycle: `100 .fdbody store` adds 100 to [[.nrg]] and subtracts 10
from [[.body]]. It is the inverse operation of [[.strbody]], and it has no extra
cost.

Some details:

- **Cap of 100 per cycle.** A larger value counts as 100. To take out more,
  write again in the following cycles.
- **Cleared when used.** After the conversion it goes back to 0, so you have to
  write it in every cycle in which you want it.
- **Negatives do nothing**: the engine clears them without converting. (In the
  original DarwinBots they stayed written in the cell; the port fixed that.)
- **It does not check how much body you have left.** If the body falls below
  0.5, the bot dies. It is a good idea to put a condition on `*.body`.
- **Energy does not go above 32000.** If you are already near the cap, the
  excess is lost, and the body is deducted anyway.

```adn
' If it runs out of energy, it eats from its body
cond
 *.nrg 1000 <
 *.body 50 >
start
 100 .fdbody store
stop
```

The typical use, together with [[.strbody]], is covered in [[sysvars/cuerpo]].
