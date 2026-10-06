---
titulo: .pval
resumen: "The value your poison writes into the .ploc cell of whoever gets poisoned by attacking you."
etiquetas: [defenses, poison, memory, configuration]
estado: revisada
---
It is the partner of [[.ploc]]: `.ploc` says _where_ and `.pval` _what_. The engine reads it
when your poison goes out toward whoever attacked you (see [[.poison]]) and, if it poisons it,
from then on it writes that value into the attacker's `.ploc` cell every cycle,
until its poisoning ([[.poisoned]]) runs out.

<!-- sysvars.yaml .pval (createshot −5 y ties → Pval del envenenado); 21-MEMORIA §4.3 -->

It is configuration: it isn't cleared, but a newborn starts with 0. With `.ploc` on
[[.shoot]], a `.pval` of `-2` makes the attacker give away energy; with `.ploc` on
[[.aimdx]], a number like 50 leaves it spinning.

<!-- 21-MEMORIA §3 (pval persistente); comprobado con probar-adn: .ploc en .aimdx y 50 en .pval, el mordedor gira 50 por ciclo -->

```adn
' whoever bites me will spin without stopping
cond
*.robage 0 =
start
.aimdx .ploc store
50 .pval store
stop

cond
*.poison 500 <
start
100 .strpoison store
stop
```
