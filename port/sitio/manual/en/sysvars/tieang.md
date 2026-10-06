---
titulo: .tieang
resumen: "Where the .tiepres tie lies as seen from the bot: 0 if it points right at the partner, signed according to the side."
etiquetas: [ties, tie, angle, senses]
estado: revisada
---
It is the angle between the way the bot points ([[.aim]]) and the direction of the
tied bot, on the scale of 1256 per full turn: 0 means you have it right in front, and the
value goes from −628 to 628 depending on which side and how far you would have to turn. The
engine publishes it at the end of every cycle, so you read it one cycle late. It is 0 if
there is no tie.

<!-- sysvars.yaml .tieang (UpdateTieAngles P5 = −AngDiff·200, ±628; 0 sin tie) -->

It always measures the [[.tiepres]] tie, even if you write another one in [[.tienum]] (see
that page). That is why the parent, which sees the birth tie with tie port 0, reads
0 here until it has another tie.

<!-- port/core ties.hpp UpdateTieAngles (tienum ya en 0 tras Update_Ties P3; whichTie = 0 → sale) y robots.hpp Reproduce (puerto 0 del padre) -->

The sign is designed for turning: writing the value to [[.aimdx]] leaves the bot
facing the partner.

<!-- comprobado con probar-adn: tras 300 .aimdx el hijo lee .tieang −300 y con *.tieang .aimdx store vuelve a 0 -->

```adn
' turn toward the tied bot
cond
*.numties 0 >
start
*.tieang .aimdx store
stop
```

Its counterpart is [[.tielen]]. For the first four ties of a multicellular bot there are
[[.tieang1]]…`.tieang4`, which use another scale (from 0 to 1256).
