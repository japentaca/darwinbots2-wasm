---
titulo: .vtimer
resumen: "The countdown of the incubating virus: 0 if there is no virus, it drops by 1 per cycle and stops at 1 until the shot."
etiquetas: [virus, sense, clock]
estado: revisada
---
<!-- 35-VIRUS §0.3, §2 (Vtimer = 2·largo, baja cada P3, se detiene en 1) -->
When the bot makes a virus with [[.mkvirus]], the engine sets the incubation to
twice the number of words in the copied gene and lowers it by 1 each cycle. `.vtimer`
shows that count:

| Value | What it means |
|---|---|
| 0 | There is no virus: you can make one. |
| more than 1 | A virus is incubating. |
| 1 | The virus is ready and waiting for a [[.vshoot]]. |

On firing it goes back to 0. If you never write `.vshoot`, it stays at 1 forever and
the bot can't make another virus.

<!-- sysvars.yaml .vtimer (se publica al empezar BotDNAManipulation, antes de fabricar); comprobado: el ciclo siguiente a la orden lee 0 y después 23, 22… -->
Like every sense, it arrives one cycle late: the cycle after the `.mkvirus` command
it still reads 0, even though the virus is already incubating. It isn't serious, because a
second command makes nothing while there is a virus, but if the condition on
`*.vtimer 0 =` does something more than request the virus, it will run twice.

It can't be written: the engine rewrites it every cycle.

```adn
' Fires the virus as soon as it is ready, with more strength if it has energy
cond
 *.vtimer 1 =
 *.nrg 5000 >
start
 100 .vshoot store
stop
cond
 *.vtimer 1 =
 *.nrg 5000 <=
start
 20 .vshoot store
stop
```
