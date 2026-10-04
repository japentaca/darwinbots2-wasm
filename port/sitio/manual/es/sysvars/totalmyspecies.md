---
titulo: .totalmyspecies
resumen: "Cuántos bots vivos hay de la especie propia, incluido el que la lee."
etiquetas: [población, sentido, especie, reproducción]
estado: revisada
---
<!-- sysvars.yaml .totalmyspecies (clamp 32000); especie por nombre, cadáveres fuera del conteo -->
`.totalmyspecies` cuenta los bots vivos de tu especie, incluido el que la lee; los
cadáveres no cuentan. La especie se reconoce por el nombre: todos los
descendientes que conservan el nombre de la especie cuentan, aunque hayan mutado
(ver [[simulacion/especies]]). La publica el motor al final de cada ciclo, y en el
primer ciclo de vida vale 0.

Es la herramienta clásica para que una especie no se ahogue a sí misma: dejar de
reproducirse cuando ya hay suficientes. [[.totalbots]], en cambio, cuenta a todo
el mundo.

```adn
' se reproduce solo mientras la especie tenga menos de 30 bots
cond
*.totalmyspecies 30 <
*.nrg 5000 >
start
50 .repro store
stop
```

El conteo tiene un tope de 32000, que en la práctica no se alcanza.
