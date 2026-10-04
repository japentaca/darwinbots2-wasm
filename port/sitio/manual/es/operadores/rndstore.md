---
titulo: rndstore
resumen: "Cambia lo que hay en una celda por un número al azar entre 0 y ese valor, con su mismo signo."
etiquetas: [rndstore, azar, aleatorio, escritura]
estado: revisada
---
<!-- 20-VM §7 (rndstore: Random(0, Abs(mem))·Sgn(mem), consume 1 RNG, sin mod32000, cost /7, sin flags de lazo); core vm.hpp DNArndstore; comprobado en el port: -5 da -5..0 (200 ciclos) -->

`d rndstore` saca la dirección `d` y reemplaza lo que hay en la celda por un
entero al azar entre 0 y ese número, los dos incluidos. No toma ningún valor
de la pila: el tope del sorteo es lo que ya estaba guardado.

| Palabra | Pila después |
|---|---|
| `50` | 50 |
| `rndstore` | (vacía); si la celda 50 tenía 20, ahora tiene algo entre 0 y 20 |

Por eso casi siempre va después de un [[op:store]] que carga el tope:

```adn
' gira después de una espera al azar de 0 a 20 ciclos
cond
 *50 0 =
start
 100 .aimdx store
 20 50 store
 50 rndstore
stop
cond
 *50 0 >
start
 50 dec
stop
```

Cada vez que la cuenta llega a 0, el bot gira con [[.aimdx]] y sortea una
espera nueva, que [[op:dec]] va bajando. Si el sorteo da 0, gira de nuevo en
el ciclo siguiente.

Con un número negativo el sorteo es simétrico: si la celda tiene −5, queda
algo entre −5 y 0. Eso la diferencia de [[op:rnd]], que con `-5` da de −4 a
−1. Sobre una celda en 0 da siempre 0.

Si solo querés un número al azar para usarlo enseguida, [[op:rnd]] es más
directo: `20 rnd 50 store` sortea en el mismo rango, de 0 a 20, que
`20 50 store 50 rndstore`. Con negativos, como se vio, los rangos cambian.
