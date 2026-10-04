---
titulo: .tielen4
resumen: "Largo del cuarto lazo de un multicelular, de borde a borde; escribirlo fija el largo natural de ese lazo."
etiquetas: [lazos, multicelular]
estado: revisada
---
Funciona igual que [[.tielen1]], pero para el **cuarto lazo** del bot, contando
desde el más antiguo que le queda (si se corta uno anterior, este corre un
lugar). Solo actúa si el bot es multicelular ([[.multi]]) y ese lazo está
endurecido; si no, el motor no toca la celda.

Al leerla, da la distancia al compañero descontando los dos radios, medida antes
de que el motor mueva a los bots. Al escribirla con [[op:store]] u otro store de
dos operandos, fija el largo natural de ese lazo para los dos extremos, como
[[.fixlen]] pero sin elegirlo con [[.tienum]]. Con [[op:inc]] o [[op:dec]] el lazo
no se entera.

<!-- sysvars.yaml .tielen4 (como tielen1, tie 4); 20-VM §7 -->

```adn
' acercar el cuarto lazo
cond
*.multi 1 =
*.tielen4 50 >
start
50 .tielen4 store
stop
```

El ángulo de este lazo se lee y se fija con [[.tieang4]].
