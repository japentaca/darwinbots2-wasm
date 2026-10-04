---
titulo: negstore
resumen: "Le cambia el signo a lo que hay en una celda: 20 pasa a −20 y −20 a 20."
etiquetas: [negstore, signo, escritura]
estado: revisada
---
<!-- 20-VM §7 (negstore: -mem, sin mod32000, cost /8, sin flags de lazo; §12.6); comprobado en el port -->

`d negstore` saca la dirección `d` y le invierte el signo a lo que haya en la
celda. No toma ningún valor de la pila.

| Palabra | Pila después |
|---|---|
| `50` | 50 |
| `negstore` | (vacía); si la celda 50 tenía 20, ahora tiene −20 |

Aplicado en cada ciclo, hace oscilar un valor entre dos extremos:

```adn
' avanza meneándose: gira 20 a un lado y 20 al otro, ciclo por medio
cond
 *50 0 =
start
 20 50 store
stop
start
 50 negstore
 *50 .aimdx store
 10 .up store
stop
```

El primer gen carga 20 la primera vez. Desde ahí la celda 50 alterna entre
−20 y 20, y el bot gira con [[.aimdx]] para un lado y para el otro mientras
avanza con [[.up]].

Es lo mismo que `-1 50 multstore` (ver [[op:multstore]]), pero más barato: la
octava parte del costo de un [[op:store]]. Ojo con [[.tieang1]] y
[[.tielen1]]: `negstore` cambia el número, pero el lazo no se entera; ahí
usá `-1 .tieang1 multstore` (ver [[adn/stores]]).
