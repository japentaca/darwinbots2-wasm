---
titulo: rnd
resumen: "Cambia el número de arriba de la pila por uno al azar entre 0 y ese número, ambos incluidos."
etiquetas: [azar, aleatorio, básicos]
estado: revisada
---
<!-- 20-VM §6.1 (rnd: Random(0, n) = Int((n+1)·rndy)); core common.hpp Random; comprobado en el port: -5 rnd da −4…−1 -->

`n rnd` saca `n` y apila un número entero al azar entre 0 y `n`, los dos
incluidos y todos con la misma probabilidad. `10 rnd` puede dar 0, 1… o 10.
Es, junto con [[op:rndstore]], la fuente de azar del ADN, y la base de cualquier comportamiento que
no sea del todo predecible: rumbos al azar, esperas variables, decisiones
que no se repiten.

```adn
cond
start
  ' gira entre 10 a la derecha y 10 a la izquierda
  20 rnd 10 sub .aimsx store
  10 .up store
stop
```

Este bot avanza zigzagueando: `20 rnd` da de 0 a 20 y, al restarle 10, el
giro de [[.aimsx]] queda entre −10 y 10. Para elegir una dirección
cualquiera, `1256 rnd .setaim store` (un giro completo son 1256 unidades,
ver [[.setaim]]).

Los casos raros:

- `0 rnd` da siempre 0.
- Con un número negativo el resultado no es simétrico: `-5 rnd` da −4, −3, −2
  o −1, nunca −5 ni 0 (en rigor el 0 sale solo si el sorteo da exactamente
  cero, algo que en la práctica no pasa). Si querés un rango con negativos, usá un positivo y restá,
  como en el ejemplo.

Para escribir directamente un valor al azar en una celda está `rndstore`.
