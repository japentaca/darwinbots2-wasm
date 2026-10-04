---
titulo: .pwaste
resumen: "Los desechos permanentes: un resto que queda cada vez que el bot tira desechos y que ya no se puede eliminar."
etiquetas: [desechos, sentido, envejecimiento]
estado: revisada
---
<!-- 31-ENERGIA §2 (Pwaste solo crece: 1 % de los −4, defacate, lazos; clamp 32000); 36-REPRO §2 (reparto al nacer) -->
Cada vez que el bot se libra de sus desechos ([[.waste]]), una parte chica no se va
y queda como desecho permanente: un 1 % de lo que tira con un disparo −4, una
fracción de lo que expulsa solo cuando pasa de 32000 y otro poco de lo que pasa por
lazos. Ese resto se acumula en `.pwaste`, con tope en 32000.

No hay forma de bajarlo: ni los disparos ni los cloroplastos lo tocan. Lo único que
lo reparte es la reproducción, porque el hijo se lleva su porcentaje (ver
[[.repro]]).

El problema es que cuenta para la toxicidad: el bot empieza a sufrir escrituras al
azar en la memoria cuando `.waste` más `.pwaste` pasan del
límite que fija la opción [[param:opt:56]] (400 si no lo cambiaste). Un bot longevo que tira muchos
desechos termina cerca del umbral solo por este resto, y entonces cualquier
desecho nuevo lo hace pasar. Es una forma de envejecimiento: reproducirse a tiempo
lo diluye.

```adn
' Si los desechos permanentes ya son muchos, se reproduce para repartirlos
cond
 *.pwaste 200 >
start
 50 .repro store
stop
```
