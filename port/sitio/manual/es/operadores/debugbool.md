---
titulo: debugbool
resumen: "Anota el valor de arriba de la pila booleana para mirarlo desde la consola del bot, sin costo."
etiquetas: [depuración, consola, booleano, avanzados]
estado: revisada
---
<!-- 20-VM §3 (CBool(−5) = True), §6.2 (debugbool: sobre vacío apila True; sin coste); comprobado en el port -->

`debugbool` mira el valor de arriba de la [[adn/pilas#booleana|pila
booleana]], _verdadero_ o _falso_, y lo anota en la traza del bot con la
posición de la palabra en el ADN. Es el par de [[op:debugint]], útil para
saber qué dio una condición. No cuesta energía.

```adn
cond
  *.nrg 1000 >
  debugbool
start
  10 .up store
stop
```

La traza se mira con el comando `debug` de la consola del bot, en el
[[app/inspector|inspector]], y muestra el último ciclo.

Hay un caso en que sí cambia algo: **con la pila booleana vacía apila un
_verdadero_**. Casi nunca se nota, porque la pila vacía ya cuenta como
verdadera, pero cambia cuántos valores hay. Por ejemplo, en
`debugbool 1 2 = swapbool` el [[op:swapbool]] tiene dos valores para
intercambiar y deja el _verdadero_ arriba; sin el `debugbool`, solo habría un
_falso_, el `swapbool` no haría nada y ese _falso_ frenaría los stores
siguientes.
