---
titulo: .eye5width
resumen: "Ensancha el ojo 5: cuanto más ancho, más campo cubre pero menos lejos ve y más chicos son sus números."
etiquetas: [ojos, visión, configuración]
estado: revisada
---
Cuánto abarca [[.eye5]] además de sus 10 grados de fábrica. Se mide en las
unidades de [[.aim]] (1256 es una vuelta; 35, unos 10 grados): con 0 el ojo
abarca 10 grados, con 35 unos 20, con 315 unos 100, y con 1221 la vuelta entera.
<!-- 32-VISION §0.2, §2.4 -->

Ensanchar tiene un precio: el alcance baja.

| `.eye5width` | Campo | Alcance |
|---|---|---|
| 0 | 10° | 1440 |
| 35 | 20° | 1190 |
| 140 | 50° | 861 |
| 315 | 100° | 611 |
| 628 | 190° | 381 |
| 1221 | 360° | 151 |

<!-- 32-VISION §0.4: 1440·(1 − ln(w/35)/4) -->

Además el valor del ojo es relativo a su alcance, así que un ojo ancho da
números más chicos a la misma distancia: un bot que el ojo de fábrica ve con
168, uno de 315 lo ve con 30. Si comparás contra un umbral fijo, como
`*.eye5 100 >`, ajustalo cuando cambies el ancho.
<!-- 32-VISION §0.3 -->

Es configuración: el motor no la borra nunca. Solo cuenta el resto de dividir
por 1256, así que por encima de 1221 el ojo vuelve a ser angosto. Los negativos
son otra rareza: de −1 a −34 el ojo se angosta y ve más lejos (hasta casi el
doble), y desde −35 para abajo un negativo se porta como si le sumaras 1256:
−100 da lo mismo que 1156, un ojo casi panorámico y de poco alcance.
<!-- 32-VISION §0.4 (AbsoluteEyeWidth), §2.4, §6.2; sysvars.yaml .eye5width (persiste) -->

```adn
' ojo 5 más ancho, puesto una sola vez
cond
*.robage 0 =
start
315 .eye5width store
stop
```

Para cambiar hacia dónde mira, usá [[.eye5dir]].
