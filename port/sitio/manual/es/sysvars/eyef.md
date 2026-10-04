---
titulo: .eyef
resumen: "Lo que ve el ojo con foco: repite el valor del ojo que elegiste con .focuseye, o el de .eye5 si no elegiste ninguno."
etiquetas: [ojos, visión, sentidos, focuseye]
estado: revisada
---
Una copia del valor del ojo con foco. Con [[.focuseye]] en 0, que es lo de
fábrica, el foco es [[.eye5]] y `.eyef` vale lo mismo que él; si movés el foco a
otro ojo, `.eyef` pasa a repetir ese. Vale 0 cuando el ojo con foco no ve nada,
y si ve algo usa la misma escala que los demás ojos
([[sysvars/ojos#valor]]).
<!-- sysvars.yaml .eyef; 32-VISION §2.6 -->

Sirve para escribir genes que no dependen de qué ojo está mirando: el bot puede
ir moviendo el foco y el resto del ADN sigue leyendo `.eyef`. Además, lo que ve
el ojo con foco es lo que describen las celdas de
[[sysvars/ref|lo que se ve]] ([[.refeye]], [[.refnrg]] y las demás), así que
`.eyef` mayor que 0 te asegura que esas celdas hablan de algo.
<!-- 32-VISION §1.4, §2.6 -->

:::nota
Leer `*.eyef` no cuenta como leer un ojo para la firma del bot: [[.myeye]] solo
cuenta las lecturas de `.eye1` a `.eye9`. Un bot que mira solo con `.eyef`
tiene `.myeye` en 0.
<!-- sysvars.yaml .myeye; makeoccurrlist cuenta *501..*509 (port/core senses.hpp) -->
:::

```adn
' foco en el ojo de más a la derecha; si ve algo, girar hacia allá
cond
*.robage 0 =
start
4 .focuseye store
stop

cond
*.eyef 0 >
*.eye5 0 =
start
140 .aimdx store
stop
```

Si el bot está metido dentro de un obstáculo y los obstáculos son visibles, los
nueve ojos y `.eyef` valen 32000.
<!-- 32-VISION §3.2; port/README.md B2-3 (el port también pone EYEF en 32000) -->
