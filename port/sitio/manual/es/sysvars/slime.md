---
titulo: .slime
resumen: "Cuánta baba tiene el bot: impide que lo aten con un lazo y frena los virus; se evapora un 2 % por ciclo."
etiquetas: [defensas, slime, lazos, virus, sentidos]
estado: revisada
---
La baba protege contra dos cosas que otro bot te puede hacer:

- **Lazos.** Cada vez que alguien intenta atarte con [[.tie]], el motor sortea un
  número entre 2 y 92; si tu slime es mayor, el lazo no se forma. Con más de 92
  ningún lazo te agarra. Cada intento, salga o no, te quita 20 de baba.
- **Virus.** Un disparo de virus primero tiene que atravesar la baba. Si no le
  alcanza la fuerza, la baba lo absorbe (y se gasta); si la atraviesa, la deja en
  0 y el virus infecta igual. Los virus están en [[sysvars/adn-y-virus]].

<!-- 34-TIES §0.5 (deflect = Random(2,92), slime −20 por intento); 33-SHOTS §5 (−7 addgene); port/core shots.hpp addgene (la potencia sobrante no se usa al insertar) -->

El motor la publica en cada ciclo después de evaporar un 2 %, así que el valor
baja solo aunque no hagas nada. Se fabrica con [[.mkslime]] y en un organismo
multicelular se reparte con [[.shareslime]].

<!-- sysvars.yaml .slime (Upkeep P1 = CInt(slime·0.98)) -->

Fijate que la baba también te impide a vos recibir lazos amigos: un hijo no se
puede atar con `.tie` a un padre que tiene más de 92 de slime, y cada intento le
come 20 de baba al padre. El lazo con el que nacen padre e hijo sí se forma,
porque el que recibe ese lazo es el hijo, que nace sin baba.

<!-- 34-TIES §1 (nacimiento vía maketie con el hijo como receptor); port/core robots.hpp Reproduce (maketie(padre, hijo, …)); comprobado con probar-adn: padre con 396 de slime, el .tie del hijo falla y el padre pierde 20 -->

```adn
' reponer baba solo si bajó de 100
cond
*.slime 100 <
start
20 .mkslime store
stop
```
