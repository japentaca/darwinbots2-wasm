---
titulo: .trefage
resumen: "La edad del bot atado: sirve para saber si del otro lado está tu padre o tu hijo."
etiquetas: [tref, lazos, edad, reproduccion]
estado: revisada
---
<!-- sysvars.yaml .trefage (= age+1 del atado, tope 32000); 34-TIES §1-§2 (el creador carga al crear; gate newage >= 2); comprobado con probar-adn -->
Vale la edad del bot atado, la misma que él lee en su [[.robage]] en ese ciclo
(con un tope de 32000). Su uso clásico es distinguir parientes: después de
reproducirse, padre e hijo quedan unidos por el lazo de nacimiento, y
`*.trefage *.robage >` es cierto solo del lado del hijo.

```adn
' Si el atado es mayor que yo (mi padre), corto el lazo
cond
*.numties 0 >
*.trefage *.robage >
start
*.tiepres .deltie store
stop
```

Fijate en el orden de los tiempos: el hijo empieza a sentir a su padre en su cuarto
ciclo de vida, y hasta entonces `.trefage` vale 0, así que la condición es falsa.
El padre, en cambio, lo siente desde el ciclo siguiente al parto: ahí ya lee que el
atado tiene edad 1, aunque el hijo todavía lee 0 en su `.robage` (ver
[[sysvars/tref#que-lazo]]). Desde el ciclo siguiente los dos números coinciden.
