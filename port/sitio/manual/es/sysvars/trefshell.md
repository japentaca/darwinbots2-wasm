---
titulo: .trefshell
resumen: "El caparazón que tiene el bot atado del otro lado del lazo."
etiquetas: [tref, lazos, defensas, caparazon]
estado: revisada
---
<!-- sysvars.yaml .trefshell; 21-MEMORIA §9.2 (el original no la borra); port/README A3-2 (el port la borra con las demás) -->
Vale el [[.shell]] del bot atado, redondeado a entero. Sirve, por ejemplo, para
repartir el trabajo en un multibot: si el compañero ya tiene caparazón, vos no
necesitás fabricarlo (ver [[.mkshell]]).

```adn
' Fabrica caparazon solo si el atado tiene poco
cond
*.numties 0 >
*.trefshell 100 <
start
10 .mkshell store
stop
```

:::nota
En el DarwinBots original esta sysvar no se borraba nunca: al perder el lazo
seguías leyendo el caparazón del último compañero. En esta versión se borra junto con las otras [[sysvars/tref|tref*]] (ver
[[tecnico/diferencias]]).
:::
