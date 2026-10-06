---
titulo: .shootval
resumen: "The adjustment for the next shot: the power or range of a −1 or −6, how much you give with a −2, or the value that a memory shot writes."
etiquetas: [shots, attack, action]
estado: revisada
---
<!-- 33-SHOTS §2.1; sysvars.yaml 8 (persiste si no se dispara); core shots.hpp robshoot (multiplicadores <=4 sin efecto, log2(x/2) arriba de 4, costo x·SHOTCOST); probado: sv.txt (0, 2, 4, -2 iguales; 8 duplica el daño), en.txt (-2 con 100: el otro gana 95), memshot.txt, persistencia con --set; revisor: core robshoot (-2/-3/-4: fabs y tope en nrg/venom/waste; -1/-6: valor y rngmultiplier > 4 pasan a log2(x/2) con costo x·SHOTCOST, recorte por nrg) -->
`.shootval` doesn't fire anything by itself: it goes along with [[.shoot]] and changes the
shot that goes out in that cycle. What it changes depends on the type:

- **−1 and −6 (steal energy or body).** A positive value multiplies the
  power and a negative one, the range. But only from 5 on: between −4 and 4
  it changes nothing. Above that the scale is logarithmic: 8 doubles the
  power, 16 triples it. And you pay for it: the shot costs the value times the
  cost of a shot. If you don't have enough energy, the engine scales it down to
  what you can pay.
- **−2 (give energy).** How much energy you send, unsigned and never more than
  you have; if you write 0, 1% of yours.
- **−3 and −4 (venom and waste).** How much you send, unsigned and never more than
  you have; with 0, a twentieth of what you have.
- **Positive (memory shot).** The value that is written to the other
  bot's memory.

```adn
' I write 77 to address 50 of the one in front of me
cond
*.eye5 0 >
start
77 .shootval store
50 .shoot store
stop
```

In the test, cell 50 of the target became 77 two cycles later.

:::cuidado
Unlike `.shoot`, the engine doesn't clear `.shootval` every cycle:
only in cycles where [[.shoot]] holds something other than 0, even if the shot
doesn't end up going out. If you write it in a cycle in which you don't shoot, it stays there and applies to the next shot, even one of a different type.
The safe way is to always write it together with the shoot order.
:::
