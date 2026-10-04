---
titulo: .tie
resumen: "Orden para atarse con un lazo al bot que se está viendo; el número que escribís es el puerto con el que vas a nombrar ese lazo."
etiquetas: [lazos, tie, multicelular]
estado: revisada
---
Escribí un número distinto de 0 y al final del ciclo el motor intenta atarte al
bot que estás viendo, el mismo que describen las celdas `ref*` como
[[.refeye]]. Si no ves a nadie, en los dos primeros ciclos de vida usa al padre,
y si no, al último bot que te tocó. Tiene que ser un bot (no un obstáculo) y estar
cerca: a unos 400 de borde a borde como mucho. La orden se borra siempre, salga o no.

<!-- sysvars.yaml .tie (FireTies P5; =0 siempre que era ≠ 0); 34-TIES §1 (lastopp a ≤ 4·RobSize + radios, fallback padre/lasttch; maketie exige length ≤ 1.5·c) -->

El número es el _puerto_: el nombre con el que vas a elegir ese lazo después en
[[.tienum]], [[.deltie]] o [[.readtie]], y queda en tu [[.tiepres]]. El otro bot
no ve tu número: para él el lazo se llama por su número de orden (1 si es el
primero que tiene).

<!-- 34-TIES §0.2 (Port = mem(tie) para el creador; slot para el receptor) -->

Lo que conviene saber:

- Cada intento con alguien a tiro cuesta energía (el costo de lazo de la
  simulación, dividido por la cantidad de lazos que ya tenés más uno), salga o no.
- Si el otro tiene baba ([[.slime]]), el lazo puede fallar; con más de 92 falla
  siempre. Cada intento le quita 20 de baba.
- Atar dos veces al mismo bot reemplaza el lazo anterior. Por eso el hijo que se
  ata al padre pisa el lazo de nacimiento.
- A los 19 ciclos el lazo se endurece y los dos bots pasan a ser multicelulares
  ([[.multi]]).
- Un bot tiene como mucho 9 lazos. Un lazo se corta solo si los bots se alejan
  más de 1000 de borde a borde.

<!-- 34-TIES §0.1 (máximo 9), §0.3 (DeleteTie antes de crear), §0.4, §0.5 (deflect, slime −20, TIECOST/(numties+1)), §1 (borrado por longitud > 1000 + radios) -->

```adn
' recién nacido: atarse al padre con el puerto 7
cond
*.robage 1 =
start
7 .tie store
stop
```

<!-- comprobado con probar-adn: el hijo queda con .tiepres 7, el padre con 1, y a los ~20 ciclos los dos tienen .multi 1 -->
