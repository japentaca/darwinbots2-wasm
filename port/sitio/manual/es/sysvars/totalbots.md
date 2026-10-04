---
titulo: .totalbots
resumen: "Cuántos bots hay en todo el mundo, contando vegetales, otras especies y cadáveres."
etiquetas: [población, sentido, mundo]
estado: revisada
---
<!-- sysvars.yaml .totalbots (contado en P2: todo bot que existe, cadáveres incluidos) -->
`.totalbots` cuenta todos los bots que existen en la simulación: los de todas las
especies, los vegetales y también los cadáveres. El bot que la lee está incluido.
La publica el motor al final de cada ciclo (en el primer ciclo de vida vale 0) y
todos los bots leen el mismo número.

Para contar solo a los propios está [[.totalmyspecies]]; la diferencia entre las
dos da cuántos bots ajenos (comida, competencia o restos) hay en el mundo.

Sirve para medir qué tan lleno está el mundo. Un bot puede, por ejemplo, dejar de
reproducirse cuando hay mucha gente, para no gastar energía en hijos que no van a
encontrar lugar:

```adn
cond
*.totalbots 200 <
*.nrg 6000 >
start
50 .repro store
stop
```
