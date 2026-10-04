---
titulo: swapbool
resumen: "Intercambia los dos valores de arriba de la pila booleana. Permite calcular dos condiciones y elegir cuál manda en cada tramo del cuerpo."
etiquetas: [pila booleana, condiciones, intercambiar]
estado: revisada
---
<!-- 20-VM §6.5 (swapbool: ≤1 no-op); comprobado en el port -->

`swapbool` intercambia los dos valores de arriba de la pila booleana. Si hay
uno solo o ninguno, no hace nada.

Dentro del cuerpo de un gen, el valor de arriba es el que decide si los
stores escriben. Con `swapbool` podés dejar preparadas dos condiciones y
pasar de una a la otra sin volver a calcularlas:

```adn
cond
start
  *.robage 3 >
  *.robage 6 <
  50 inc
  swapbool
  51 inc
  clearbool
stop
```

El primer `inc` depende de la condición de arriba, «edad menor que 6»
([[.robage]]); después del `swapbool` manda la otra, «edad mayor que 3».
Después de 10 ciclos las celdas 50 y 51 valen 6 cada una: la 50 contó las
edades 0 a 5 y la 51, las edades 4 a 9. El [[op:clearbool]] final deja la pila
limpia para el gen siguiente.

Para intercambiar números en la pila entera está [[op:swap]].
