---
titulo: Flujo
resumen: "cond, start, else, stop y end: los marcadores que arman los genes y deciden qué partes del ADN corren en cada ciclo."
etiquetas: [flujo, gen, cond, start, else, stop]
estado: revisada
---
<!-- 20-VM §4 (tipo 9 sin gate, FLOWCOST siempre; mem(341) = currgene), §5.1-5.6; opcodes.yaml flujo, flujo_maestro; core vm.hpp ExecuteFlowCommands (else corregido, A2-1) -->

Estas palabras no calculan nada ni tocan la pila entera: ordenan el ADN en
_genes_. El ADN se recorre entero, de izquierda a derecha, en cada ciclo, y
cada marcador cambia el estado del intérprete al pasar:

- [[op:cond]] abre un gen y la zona de condiciones.
- [[op:start]] cierra las condiciones y abre el cuerpo, que corre si todas
  dieron verdadero.
- [[op:else]] abre un cuerpo alternativo, que corre si dieron falso.
- [[op:stop]] cierra el gen.
- [[op:end]] termina el ADN; lo que siga no se ejecuta.

La forma de casi todos los genes es `cond … start … stop`, con `else` cuando
hace falta un «si no»:

```adn
' avanza mientras tenga más de 2000 de energía; si no, gira
cond
 *.nrg 2000 >
start
 20 .up store
else
 50 .aimdx store
stop
```

No hay anidamiento ni bloques: los marcadores son planos. Un `cond` en
cualquier lugar abre un gen nuevo aunque al anterior le falte el `stop`, y
lo que queda fuera de un gen (antes del primer marcador o entre un `stop` y
el siguiente) no se ejecuta.

A diferencia del resto de las palabras, `cond`, `start`, `else` y `stop` se
procesan siempre, aunque el gen se esté salteando, y cobran su costo cada
vez. Después de cada uno el motor anota en [[.thisgene]] el número del gen en
curso. `end` no cuesta nada: ahí se corta el recorrido.

Todo esto, con más ejemplos y la numeración de los genes, está en
[[adn/genes]]. Cómo se combinan las condiciones está en
[[adn/condiciones]].
