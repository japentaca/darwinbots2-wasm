---
titulo: .eye1width
resumen: "Widens eye 1: the wider it is, the more field it covers, but the shorter its range and the smaller its numbers."
etiquetas: [eyes, vision, configuration]
estado: revisada
---
How much [[.eye1]] covers on top of its factory 10 degrees. It is measured in the
units of [[.aim]] (1256 is a full turn; 35 is about 10 degrees): with 0 the eye
covers 10 degrees, with 35 about 20, with 315 about 100, and with 1221 the whole circle.
<!-- 32-VISION §0.2, §2.4 -->

Widening has a price: the range drops.

| `.eye1width` | Field | Range |
|---|---|---|
| 0 | 10° | 1440 |
| 35 | 20° | 1190 |
| 140 | 50° | 861 |
| 315 | 100° | 611 |
| 628 | 190° | 381 |
| 1221 | 360° | 151 |

<!-- 32-VISION §0.4: 1440·(1 − ln(w/35)/4) -->

Also, the eye's value is relative to its range, so a wide eye gives smaller
numbers at the same distance: a bot that the factory eye reads as 168 reads as 30
on an eye set to 315. If you compare against a fixed threshold, like
`*.eye1 100 >`, adjust it when you change the width.
<!-- 32-VISION §0.3 -->

It is configuration: the engine never clears it. Only the remainder of dividing
by 1256 counts, so above 1221 the eye becomes narrow again. Negatives are
another oddity: from −1 to −34 the eye narrows and sees farther (up to almost
double), and from −35 downward a negative behaves as if you had added 1256 to it:
−100 gives the same as 1156, an almost panoramic eye with little range.
<!-- 32-VISION §0.4 (AbsoluteEyeWidth), §2.4, §6.2; sysvars.yaml .eye1width (persiste) -->

```adn
' eye 1 wider, set only once
cond
*.robage 0 =
start
135 .eye1width store
stop
```

To change where it looks, use [[.eye1dir]].
