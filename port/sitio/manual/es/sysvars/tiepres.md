---
titulo: .tiepres
resumen: "El puerto del último lazo que se formó (creado por vos o por otro hacia vos): el lazo que usan las órdenes cuando .tienum vale 0."
etiquetas: [lazos, tie, sentidos]
estado: revisada
---
El motor la escribe cada vez que se forma un lazo en el que participás. Si lo
creaste vos con [[.tie]], vale el número que pusiste ahí; si te ataron, vale el
número de orden que el lazo tiene entre los tuyos (1 si es el primero). Cuando se
borra el lazo que señalaba, pasa al lazo anterior de tu lista (el que se formó
antes); si el borrado era el más antiguo, queda en 0 aunque te queden otros.

<!-- sysvars.yaml .tiepres (maketie = puerto de la última tie; DeleteTie lo repara); port/core ties.hpp DeleteTie (k > 1 ? Ties(k−1).Port : 0) -->

Es el lazo «por defecto»: [[.tieang]] y [[.tielen]] siempre describen este, y las
órdenes que dependen de [[.tienum]] lo usan cuando `.tienum` vale 0.

Dos rarezas:

- Al nacer, el padre ve el lazo de nacimiento con el puerto 0, así que su
  `.tiepres` queda en 0 y para él es como no tener lazo seleccionado. El hijo, en
  cambio, lo ve con el puerto 1 y lo puede usar.
- El motor solo la reescribe cuando se crea o se borra un lazo. Si la escribís
  vos, el valor queda: es una forma de cambiar qué lazo miden `.tieang` y
  `.tielen`.

<!-- 34-TIES §1 (nacimiento: Port = 0), §4.3; port/core ties.hpp UpdateTieAngles (lee mem(454) si tienum = 0); comprobado por el redactor con probar-adn: 99 .tiepres deja .tielen en 0 -->

```adn
' hablarle siempre al último que me ató o al que até
cond
*.tiepres 0 !=
start
*.tiepres .tienum store
60 .tieloc store
*.nrg .tieval store
stop
```

Este ejemplo le escribe tu energía en la celda 60 del otro bot. Hace falta copiar
`.tiepres` en `.tienum` porque escribir en la memoria del otro exige un `.tienum`
distinto de 0 (ver [[.tieloc]]).
