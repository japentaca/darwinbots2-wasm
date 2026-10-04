---
titulo: end
resumen: "Termina el ADN: lo que venga después no se ejecuta. El motor agrega uno al final si no lo ponés."
etiquetas: [end, fin, flujo]
estado: revisada
---
<!-- 20-VM §2.2 (el cargador añade siempre end; un end en medio no corta la carga), §2.6 (DnaLen hasta el primer end), §4 (el bucle para en el primer end); opcodes.yaml flujo_maestro; comprobado en el port -->

`end` marca el final del ADN: la ejecución de cada ciclo se detiene en el
primer `end` que encuentra. No hace falta escribirlo, porque al cargar el bot
el motor agrega uno al final. Tampoco cuesta energía.

Si ponés un `end` en el medio, lo que sigue se carga igual pero no corre:

```adn
' el segundo gen está después del end y no se ejecuta
start
 1 50 store
stop
end
start
 2 51 store
stop
```

La celda 50 vale 1 y la 51 queda en 0. Lo que está después tampoco cuenta en
[[.dnalen]], que mide el ADN hasta el primer `end` (acá, 6 palabras contando el `end`), ni en
[[.genes]], que vale 1.

Sirve para desactivar de un saque la parte final de un bot mientras lo
probás, sin borrarla. Lo que queda después del `end` sigue siendo parte del
ADN del bot (las mutaciones pueden tocarlo), solo que no se ejecuta.
