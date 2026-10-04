---
titulo: .trefnrg
resumen: "La energía del bot atado del otro lado del lazo que estás leyendo."
etiquetas: [tref, lazos, energia]
estado: revisada
---
<!-- sysvars.yaml .trefnrg; 21-MEMORIA §9.3 (el original se congela con 32000 exactos); port/README A3-3 (el port topa en ±32000) -->
Vale la energía ([[.nrg]]) del bot atado, redondeada a entero. Es lo que se mira
antes de pasarle energía a un compañero o de pedírsela: junto con tu propia `.nrg`
te dice quién de los dos está mejor. Las transferencias por lazo se hacen con
[[.tieloc]] y [[.tieval]] (ver [[simulacion/lazos]]).

```adn
' Si el atado tiene menos de la mitad de mi energia, la celda 50 vale 1
cond
*.numties 0 >
*.trefnrg 2 mult *.nrg <
start
1 50 store
stop
```

:::nota
Los datos de arriba vienen del DarwinBots original, donde un compañero con 32000
exactos de energía dejaba esta sysvar congelada en el valor anterior. En esta
versión se topa: si el otro tiene 32000 o más, leés 32000 (ver
[[tecnico/diferencias]]).
:::
