---
titulo: .shareslime
resumen: "In a multicellular organism, the percentage of the slime pooled with each partner that you want to keep (1 to 99)."
etiquetas: [ties, multicellular, slime, sharing]
estado: revisada
---
It works like [[.sharenrg]], but with the slime ([[.slime]]): for each tie, the
engine adds your slime and your partner's and leaves you the percentage you asked for. It is useful
for protecting the whole organism against enemy ties and viruses even if a
single cell makes it.

The conditions are the same: only if you are multicellular ([[.multi]]), only through
the ties you created yourself with [[.tie]], and the engine clears the order every cycle.
The value is clipped to 0…99 (100 counts as 99) and a 0 does nothing. There is no cap
per cycle and no fee. The sharing is immediate, but `.slime` shows it one
cycle later than usual: the engine doesn't publish it again until the next
cycle.

<!-- sysvars.yaml .shareslime (clamp 0..99; =0 cada P3) y .slime (tras shareslime se refleja recién en el Upkeep siguiente); 34-TIES §2.1 -->

Keep in mind that a partner's slime also rejects your own ties: a
bot with more than 92 slime doesn't let anyone tie to it.

<!-- 34-TIES §0.5 -->

```adn
' share the slime evenly with the partners
cond
*.multi 1 =
start
50 .shareslime store
stop
```
