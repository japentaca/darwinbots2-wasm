---
titulo: dec
resumen: "Le resta 1 a una celda de memoria: la forma barata de llevar una cuenta regresiva."
etiquetas: [dec, contador, temporizador, escritura]
estado: revisada
---
<!-- 20-VM §7 (dec: un operando, mod32000, cost /10, sin flags de lazo); comprobado en el port -->

`d dec` saca la dirección `d` y le resta 1 a lo que haya en esa celda. Es el
gemelo de [[op:inc]]: no toma ningún valor de la pila y cuesta la décima
parte de un [[op:store]].

| Palabra | Pila después |
|---|---|
| `50` | 50 |
| `dec` | (vacía); la celda 50 vale uno menos |

Su lugar natural son los temporizadores: cargás una celda con un número y la
bajás de a uno hasta que llega a 0.

```adn
' gira una vez cada 5 ciclos
cond
 *50 0 >
start
 50 dec
stop
cond
 *50 0 =
start
 100 .aimdx store
 5 50 store
stop
```

En el primer ciclo la celda 50 está en 0: el bot gira con [[.aimdx]] y la
carga con 5. Después baja 4, 3, 2, 1 y vuelve a 0 en el ciclo 6, cuando gira
otra vez.

`dec` no se detiene en 0: si no lo cortás con una condición, sigue en
negativo. Y por debajo de −32000 vuelve a −1. Como [[op:inc]], tampoco le
avisa al sistema de lazos si escribís en [[.tieang1]] o [[.tielen1]]; para
esas celdas usá `1 .tieang1 substore`.

Para restar otra cantidad, [[op:substore]].
