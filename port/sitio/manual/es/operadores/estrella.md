---
titulo: *
resumen: "Lee la memoria en una dirección calculada: saca una dirección de la pila y apila lo que hay en esa celda."
etiquetas: [memoria, lectura, dirección, básicos]
estado: revisada
---
<!-- 20-VM §6.1 (* deref: Abs Mod 1000, 0 → 1000); sysvars.yaml 501-509 (eye1..eye9) -->

`dirección *` hace lo mismo que la [[operadores/lectura|lectura con
asterisco pegado]], pero con la dirección tomada de la pila: `60 *` apila lo
mismo que `*60`. La diferencia es que la dirección puede salir de una cuenta,
y eso permite recorrer la memoria como si fuera una tabla.

Por ejemplo, los ojos [[.eye1]] a [[.eye9]] ocupan las celdas 501 a 509. Este
bot guarda en la celda 50 qué ojo quiere mirar (del 1 al 9) y copia lo que ve
ese ojo a la celda 60:

```adn
cond
start
  ' la dirección es 500 + el número de ojo
  500 *50 add * 60 store
stop
```

Como en cualquier lectura, la dirección pasa por la misma regla: se le saca
el signo y se toma el resto de dividir por 1000, y un 0 lee la celda 1000
(`0 *` lee la 1000, `1050 *` lee la 50). No hay forma de leer fuera de la
memoria del bot.

:::nota
Ojo con no confundirlo con el asterisco pegado: `*50` es una sola palabra (lee
la 50), mientras que `50 *` son dos (apila 50 y después lee). Y un `*`
suelto con la pila vacía lee la celda 1000, porque la pila vacía da 0.
:::
