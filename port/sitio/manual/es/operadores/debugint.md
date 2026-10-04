---
titulo: debugint
resumen: "Anota el número de arriba de la pila entera para mirarlo desde la consola del bot, sin sacarlo y sin costo."
etiquetas: [depuración, consola, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (debugint: round-trip por Single, sin coste), §1 (ADCMDCOST solo value < 13), §4 (dbgstring se vacía en cada ExecuteDNA); comprobado en el port -->

`debugint` mira el número que está arriba de la pila entera y lo anota, junto
con la posición de la palabra en el ADN, en la traza del bot. La pila queda
igual. Es la forma de ver qué valor tiene un cálculo a mitad de camino sin
cambiar lo que hace el bot.

```adn
cond
start
  *.nrg debugint 10 div debugint .up store
stop
```

Para ver la traza, abrí la consola del bot en el [[app/inspector|inspector]] y usá el
comando `debug`: muestra cada valor anotado con su posición. La traza se
borra al empezar el turno de cada bot, así que siempre ves la del último
ciclo.

No cuesta energía, a diferencia del resto de los avanzados, así que se puede
dejar en el ADN mientras se prueba. Con una salvedad: con números de más de
16.777.216 (que solo salen de cuentas grandes, nunca de la memoria) puede
cambiar el valor en algunas unidades al anotarlo. Para la pila booleana
está [[op:debugbool]].
