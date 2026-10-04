---
titulo: .tieloc
resumen: "Qué hacer por el lazo elegido: un número de 1 a 1000 escribe .tieval en esa celda del otro bot; -1, -3, -4 y -6 pasan o sacan energía, veneno, desecho o cuerpo."
etiquetas: [lazos, tie, memoria, energía]
estado: revisada
---
Se usa siempre junto con [[.tieval]] y actúa sobre el lazo que elegiste con
[[.tienum]]. Tiene dos modos:

**Positivo (1 a 1000): escribir en el otro.** El motor pone `.tieval` en esa
celda de la memoria del bot atado. Puede ser memoria libre, para pasarle datos, o
una orden suya, como [[.up]] o [[.shoot]]. Ocurre en el mismo ciclo, después de
que corrió el ADN de todos, así que el otro lo lee en su próximo turno. En este
modo `.tienum` tiene que ser distinto de 0: no alcanza con [[.tiepres]].

<!-- 34-TIES §2 (tieportcom P1: tienum ≠ 0 y tieloc 1..1000), §4.3; 21-MEMORIA §4.1 -->

**Negativo: transferir.** Con `.tieval` positivo das; con negativo sacás. Acá
sí vale el lazo de `.tiepres` cuando `.tienum` está en 0:

| `.tieloc` | Qué pasa | Tope por ciclo |
|---|---|---|
| `-1` | Energía. Quien recibe se queda con el 70 % como energía, casi un 3 % como cuerpo y un 1 % como desecho | dar 1000, sacar 3000 |
| `-3` | Veneno. Al dar, lo paraliza con tu [[.vloc]] y [[.venval]] (sea o no de tu especie); al sacar, te quedás con su veneno | 100 |
| `-4` | Desecho ([[.waste]]) | 1000 |
| `-6` | Cuerpo. Quien recibe se queda con casi todo como cuerpo | dar 100, sacar 300 |

Sacar energía o cuerpo a un bot de otra especie que tenga suficiente toxina
([[.poison]]) te envenena en vez de alimentarte.

<!-- 34-TIES §2 (transferencias P3: −1 ±1000/−3000, −3 ±100, −4 ±1000, −6 +100/−300, retaliación por poison); port/core ties.hpp tie_transfers (0.7/0.029/0.01 en −1; 0.987 body en −6; −3 sin chequeo de especie) -->

Cuando la orden se cumple, el motor borra `.tieloc` y `.tieval`. Pero no
siempre se borran: una escritura (positivo) que no encuentra un lazo con ese
puerto queda escrita, y lo mismo una transferencia si no tenés lazos o si
`.tienum` y `.tiepres` están en 0. Ojo, porque esa orden vieja se ejecuta más
adelante, en cuanto un lazo la tome.

<!-- sysvars.yaml .tieloc (borra tieportcom al transferir; Update_Ties tras procesar negativos); port/core ties.hpp (tieportcom solo borra si hay puerto igual; tie_transfers no corre con tn = 0); comprobado con probar-adn: 99 .tienum + 60 .tieloc sin lazo 99, .tieloc sigue en 60 -->

```adn
' alimentarse del bot atado por el lazo 7
start
7 .tienum store
-1 .tieloc store
-100 .tieval store
stop
```

Con esto el otro pierde 100 de energía y vos ganás 70, más un poco de cuerpo.
