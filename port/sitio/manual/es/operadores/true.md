---
titulo: true
resumen: "Apila un verdadero en la pila booleana. Dentro del cuerpo de un gen, vuelve a habilitar los stores que una condición había frenado."
etiquetas: [lógica, pila booleana, constante]
estado: revisada
---
<!-- 20-VM §6.5 (true), §4 (gate de stores: tope sin consumir); comprobado en el port -->

`true` apila un _verdadero_ en la pila booleana, sin mirar nada.

Su uso real está dentro del cuerpo de un gen. Ahí cada store mira el valor de
arriba de la pila booleana; después de una condición en línea falsa, los
stores dejan de escribir. Un `true` tapa esa condición y los stores que siguen
vuelven a correr, pase lo que pase:

```adn
cond
start
  *.robage 3 <
  50 inc
  true
  51 inc
  dropbool
  52 inc
stop
```

Después de 10 ciclos la celda 50 vale 3 (solo contó mientras [[.robage]] era
menor que 3), la 51 vale 10 y la 52 vale 3 otra vez. El `true` no borra la
condición: la tapa. Cuando el [[op:dropbool]] saca el `true`, la condición de
abajo vuelve a mandar. Si lo que querés es olvidarla del todo, usá
[[op:clearbool]].

En la sección `cond` no aporta nada: una pila vacía ya cuenta como
verdadera, y el `start` hace el _y_ de todo. El bot _Animal_Minimalis
Antivirus_ (Shasta), del Bestiario, lo usa al final de un gen para que su
último store corra siempre; el ejemplo está en [[adn/condiciones]].

Lo opuesto es [[op:false]].
