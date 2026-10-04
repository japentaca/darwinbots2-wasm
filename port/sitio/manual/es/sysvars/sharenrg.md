---
titulo: .sharenrg
resumen: "En un multicelular, qué porcentaje de la energía sumada con cada compañero querés quedarte; el motor reparte en el mismo ciclo."
etiquetas: [lazos, multicelular, energía, compartir]
estado: revisada
---
Escribí un porcentaje de 1 a 100. Por cada lazo, el motor suma tu energía y la del
compañero y te deja ese porcentaje del total; el resto queda para él. Con 50 los
dos quedan parejos, con 90 te quedás casi todo, con 10 se lo das.

<!-- sysvars.yaml .sharenrg (% del total de nrg que quiero tener; Mod 100, 0 → 100) -->

Condiciones y límites:

- Solo funciona si sos multicelular ([[.multi]]) y solo por los lazos que creaste
  vos con [[.tie]]. Desde el otro extremo, la orden no hace nada: si el hijo se
  ató al padre, es el hijo el que tiene que pedir el reparto.
- En un ciclo no se mueve más energía que tu cuerpo ([[.body]]); si la
  diferencia es grande, tarda varios ciclos.
- Quien pide el reparto paga el 1 % de lo que se movió.
- El valor se toma módulo 100, y un resto de 0 (como 200) vale 100: 100 es «todo para mí»
  y 150 es 50. Un 0 o un negativo no hace nada.

<!-- 34-TIES §2 (sharing P3, solo multibot y ties no-back), §2.1 (límite por body, 1 % al iniciador); comprobado con probar-adn: con 90 en los dos, solo el hijo (creador) mueve energía, de a 500 por ciclo (su body) y pagando 5 -->

El motor borra la orden en cada ciclo, así que hay que escribirla siempre. Es de
las celdas más usadas del Bestiario: muchos multicelulares escriben `99` o `50`
en cada ciclo.

<!-- 34-TIES §2.1 (celdas de sharing a 0 cada P3); Bestiario: 87 bots con 50 .sharenrg y 55 con 99 .sharenrg -->

```adn
' recién nacido: atarse al padre y, ya multicelular, repartir parejo
cond
*.robage 1 =
start
7 .tie store
stop

cond
*.multi 1 =
start
50 .sharenrg store
stop
```

Lo mismo para el desecho, el caparazón, la baba y los cloroplastos lo hacen
[[.sharewaste]], [[.shareshell]], [[.shareslime]] y [[.sharechlr]].
