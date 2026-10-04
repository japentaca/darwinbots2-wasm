---
titulo: .tienum
resumen: "Elige, por su puerto, sobre qué lazo actúan las órdenes de este ciclo (.tieloc, .fixang, .fixlen, .stifftie); 0 usa el de .tiepres."
etiquetas: [lazos, tie]
estado: revisada
---
Si tenés varios lazos, escribí acá el puerto del que querés usar: el que pusiste
en [[.tie]] si lo creaste vos, o su número de orden si te ataron. Lo usan
[[.tieloc]] y [[.tieval]], [[.fixang]], [[.fixlen]] y [[.stifftie]]. Con 0 se usa
el lazo de [[.tiepres]], salvo en un caso: para escribir en la memoria del otro
(`.tieloc` positivo) hace falta un `.tienum` distinto de 0.

<!-- sysvars.yaml .tienum (selector para tieportcom/Update_Ties, 0 = tiepres); 34-TIES §2, §4.3 -->

El motor la vuelve a 0 en cada ciclo después de usarla, así que hay que escribirla
en el mismo ciclo que la orden. Si el bot no tiene ningún lazo, el valor queda
escrito.

<!-- sysvars.yaml .tienum (=0 cada P3; sin ties, el GoTo getout salta el reset) -->

Lo que **no** elige es qué lazo miden [[.tieang]] y [[.tielen]]: cuando el motor
los calcula, `.tienum` ya está en 0, así que siempre describen el de `.tiepres`.
Para medir varios lazos están [[.tieang1]]…`.tieang4` y [[.tielen1]]…`.tielen4`.

<!-- 10-CICLO §2 (Update_Ties en P3 antes de UpdateTieAngles en P5); port/core ties.hpp (reset de tienum al final de Update_Ties); comprobado por el redactor con probar-adn -->

```adn
' pasarle 100 de energía al lazo 7
start
7 .tienum store
-1 .tieloc store
100 .tieval store
stop
```
