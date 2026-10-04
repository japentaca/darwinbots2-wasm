---
titulo: .treffixed
resumen: "Vale 1 si el bot atado está fijo en su lugar, 0 si se puede mover."
etiquetas: [tref, lazos, fijo]
estado: revisada
---
<!-- sysvars.yaml .treffixed (1/0 según Fixed del atado), .fixpos; 30-FISICA (un bot Fixed no recibe fuerzas, vel = 0) -->
Vale 1 si el bot atado está anclado (porque escribió en [[.fixpos]])
y 0 si no. Es el [[.fixed]] del otro, leído por el lazo; la
versión de la vista es [[.reffixed]].

Sirve en organismos donde una célula hace de ancla y las demás se mueven: si sabés
que el otro extremo está fijo, tirar de él no lo va a mover.

```adn
' Si el atado esta fijo, me anclo yo tambien
cond
*.numties 0 >
*.treffixed 1 =
start
1 .fixpos store
stop
```
