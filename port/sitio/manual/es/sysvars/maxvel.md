---
titulo: .maxvel
resumen: "La velocidad máxima que permite la simulación; ningún bot puede ir más rápido."
etiquetas: [velocidad, física, configuración]
estado: revisada
---
<!-- sysvars.yaml .maxvel; 30-FISICA §6 (MaxVelocity forzado a 40 fuera de (0,200]), §2.1 -->
`.maxvel` informa el límite de velocidad de la simulación. Es un dato del mundo,
igual para todos los bots: lo fija la configuración (por defecto 40, y nunca más
de 200) y el motor lo publica en cada ciclo. Escribir en ella no cambia nada.

Ese tope actúa dos veces. Ningún bot puede ir más rápido que `.maxvel` ([[.velscalar]]
nunca lo supera), y el empujón de un ciclo, después de multiplicarse por la masa,
también se recorta a ese valor. Por eso empujar con [[.up]] mucho más que
`.maxvel` es gastar de más.

<!-- sysvars.yaml .maxvel (UpdatePosition P3); probado: 0 en el primer ciclo -->
Como el motor la publica al final del ciclo, en el primer ciclo de vida del bot
vale 0.

Un uso razonable es empujar solo cuando todavía falta velocidad:

```adn
' acelera hasta el tope y después deja de empujar
cond
*.velup *.maxvel <
start
*.maxvel *.velup sub .up store
stop
```
