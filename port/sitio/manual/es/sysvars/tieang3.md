---
titulo: .tieang3
resumen: "Ángulo del tercer lazo de un multicelular respecto de hacia dónde apunta el bot (0 a 1256); escribirlo fija ese ángulo."
etiquetas: [lazos, multicelular, ángulo]
estado: revisada
---
Funciona igual que [[.tieang1]], pero para el **tercer lazo** del bot, contando
desde el más antiguo que le queda (si se corta uno anterior, este corre un
lugar). Solo actúa si el bot es multicelular ([[.multi]]) y ese lazo está
endurecido; si no, el motor no toca la celda. Tampoco la toca si [[.tienum]] y [[.tiepres]] valen 0 los dos.

Al leerla, da la dirección del compañero vista desde el bot, de 0 a 1256, medida
antes de que el motor mueva a los bots. Al escribirla con [[op:store]] u otro
store de dos operandos, fija el ángulo de ese lazo como lo haría [[.fixang]], sin
elegirlo con [[.tienum]]. Con [[op:inc]] o [[op:dec]] el lazo no se entera.

<!-- sysvars.yaml .tieang3 (como tieang1, tie 3); 20-VM §7 -->

```adn
' poner el tercer lazo a un cuarto de vuelta
cond
*.multi 1 =
start
314 .tieang3 store
stop
```

El largo de este lazo se lee y se fija con [[.tielen3]].
