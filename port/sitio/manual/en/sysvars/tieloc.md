---
titulo: .tieloc
resumen: "What to do through the chosen tie: a number from 1 to 1000 writes .tieval to that cell of the other bot; -1, -3, -4 and -6 pass or take energy, venom, waste or body."
etiquetas: [ties, tie, memory, energy]
estado: revisada
---
It is always used together with [[.tieval]] and acts on the tie you picked with
[[.tienum]]. It has two modes:

**Positive (1 to 1000): write to the other bot.** The engine puts `.tieval` in that
cell of the tied bot's memory. It can be free memory, to pass it data, or
one of its own commands, such as [[.up]] or [[.shoot]]. It happens in the same cycle, after
everyone's DNA has run, so the other bot reads it on its next turn. In this
mode `.tienum` has to be other than 0: [[.tiepres]] isn't enough.

<!-- 34-TIES §2 (tieportcom P1: tienum ≠ 0 y tieloc 1..1000), §4.3; 21-MEMORIA §4.1 -->

**Negative: transfer.** With a positive `.tieval` you give; with a negative one you take. Here
the `.tiepres` tie does count when `.tienum` is 0:

| `.tieloc` | What happens | Cap per cycle |
|---|---|---|
| `-1` | Energy. The receiver keeps 70% as energy, almost 3% as body and 1% as waste | give 1000, take 3000 |
| `-3` | Venom. When giving, it paralyzes the other bot with your [[.vloc]] and [[.venval]] (whether or not it is of your species); when taking, you keep its venom | 100 |
| `-4` | Waste ([[.waste]]) | 1000 |
| `-6` | Body. The receiver keeps almost all of it as body | give 100, take 300 |

Taking energy or body from a bot of another species that has enough poison
([[.poison]]) poisons you instead of feeding you.

<!-- 34-TIES §2 (transferencias P3: −1 ±1000/−3000, −3 ±100, −4 ±1000, −6 +100/−300, retaliación por poison); port/core ties.hpp tie_transfers (0.7/0.029/0.01 en −1; 0.987 body en −6; −3 sin chequeo de especie) -->

When the order is carried out, the engine clears `.tieloc` and `.tieval`. But they are
not always cleared: a write (positive) that doesn't find a tie with that
tie port stays written, and so does a transfer if you have no ties or if
`.tienum` and `.tiepres` are 0. Careful, because that old order runs later,
as soon as a tie picks it up.

<!-- sysvars.yaml .tieloc (borra tieportcom al transferir; Update_Ties tras procesar negativos); port/core ties.hpp (tieportcom solo borra si hay puerto igual; tie_transfers no corre con tn = 0); comprobado con probar-adn: 99 .tienum + 60 .tieloc sin lazo 99, .tieloc sigue en 60 -->

```adn
' feed on the bot tied through tie 7
start
7 .tienum store
-1 .tieloc store
-100 .tieval store
stop
```

With this, the other bot loses 100 energy and you gain 70, plus a little body.
