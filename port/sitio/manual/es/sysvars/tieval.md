---
titulo: .tieval
resumen: "El valor que acompaña a .tieloc: lo que se escribe en la memoria del otro bot o cuánto se transfiere por el lazo."
etiquetas: [lazos, tie, memoria]
estado: revisada
---
Sola no hace nada: es el segundo dato de [[.tieloc]].

- Si `.tieloc` es una dirección (1 a 1000), `.tieval` es el número que se escribe
  ahí, en la memoria del bot atado.
- Si `.tieloc` es `-1`, `-3`, `-4` o `-6`, `.tieval` es la cantidad: positiva para
  dar, negativa para sacar, con los topes que muestra la página de `.tieloc`.

El motor la borra junto con `.tieloc` cuando la orden se cumple; si no hay lazo
que la tome, puede quedar escrita (ver la página de `.tieloc`).

<!-- sysvars.yaml .tieval (valor a inyectar / cantidad; se borra con tieloc); 34-TIES §2 -->

```adn
' avisarle a mi compañero del lazo 7 que vi algo
cond
*.eye5 0 >
start
7 .tienum store
70 .tieloc store
*.refxpos .tieval store
stop
```

El compañero encuentra el dato en su celda 70 en el ciclo siguiente. Para pasar
datos de forma permanente, sin escribir en la memoria del otro, también están los
canales [[.tout1]] y [[.tin1]] (ver [[sysvars/entradas-salidas]]).

<!-- 21-MEMORIA §4.1 (tieportcom P1); sysvars.yaml .tout1/.tin1 (canal persistente leído por el atado) -->
