---
titulo: .sharewaste
resumen: "In a multicellular organism, the percentage of the waste pooled with each partner that you want to keep (1 to 99)."
etiquetas: [ties, multicellular, waste, sharing]
estado: revisada
---
It works like [[.sharenrg]], but with the waste ([[.waste]]): for each tie, the
engine adds your waste and your partner's and leaves you the percentage you asked for. What is
interesting is usually the opposite of energy: asking for **little**, to pass your
waste on to another cell. With 1 you keep almost nothing.

The conditions are the same: only if you are multicellular ([[.multi]]), only through
the ties you created yourself with [[.tie]], and the engine clears the order every cycle.
The value is clipped to 0…99 (a 100 counts as 99) and a 0 does nothing. Here there is no
cap per cycle and no fee: the sharing is immediate.

<!-- sysvars.yaml .sharewaste (clamp 0..99 in place; =0 cada P3); 34-TIES §2 (gate > 0, ties no-back), §2.1 -->

```adn
' pass my waste on to the partners
cond
*.multi 1 =
*.waste 100 >
start
1 .sharewaste store
stop
```

Another way of getting rid of waste through a tie is [[.tieloc]] `-4`.
