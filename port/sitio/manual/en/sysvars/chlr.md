---
titulo: .chlr
resumen: "How many chloroplasts the bot has, from 0 to 32000, after the cycle's natural loss."
etiquetas: [chloroplasts, sense, photosynthesis]
estado: revisada
---
<!-- 50-MUNDO §2.2 (ganancia con −(chlr/32000)² y descuento por edad) -->
This is the bot's number of chloroplasts. With more chloroplasts it gains more from the sun,
though not proportionally: the gain has a discount that weighs more the more it
has, and another that grows with age (the formula is in
[[simulacion/cloroplastos]]).

<!-- sysvars.yaml .chlr (ManageChlr P5, tras el decaimiento); 31-ENERGIA §3 -->
The engine publishes it at the end of every cycle, after applying the purchases from
[[.mkchlr]], the removals from [[.rmchlr]] and the natural loss. That loss is half a
chloroplast per cycle when it has few, and it shrinks as it has more: with
8000 it is one twentieth, with 16000 one two-hundredth. Since the cell is published
rounded, a bot with few chloroplasts sees the number go down by 1 every
few cycles.

It is split on reproduction (the child takes its percentage) and can be shared
within an organism with [[.sharechlr]]. A freshly loaded bot reads it as 0 in its
first cycle, even if it is a vegetable.

```adn
' At 500 cycles, if it has no chloroplasts, it buys a thousand
cond
 *.robage 500 >
 *.chlr 0 =
 *.nrg 2000 >
start
 1000 .mkchlr store
stop
```
