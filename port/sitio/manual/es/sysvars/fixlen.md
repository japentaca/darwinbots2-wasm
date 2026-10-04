---
titulo: .fixlen
resumen: "Orden para fijar el largo natural de un lazo endurecido, medido de borde a borde entre los dos bots."
etiquetas: [lazos, tie, multicelular]
estado: revisada
---
Cambia el largo de reposo del lazo elegido con [[.tienum]] (o el de
[[.tiepres]]). El número es la distancia de borde a borde que querés entre los dos
bots; se toma sin signo y vale para los dos extremos. A partir de ahí el lazo
actúa como un resorte que empuja o tira hacia ese largo; tolera unas 20 unidades
de diferencia sin hacer fuerza, así que los bots suelen quedar oscilando
alrededor del valor.

<!-- sysvars.yaml .fixlen (NaturalLength = Abs(valor) + radios en ambos extremos); 34-TIES §1; 30-FISICA §3.1 (muelle con zona muerta de 20); comprobado con probar-adn: con 150, .tielen oscila entre ~118 y ~164 -->

Solo actúa sobre lazos endurecidos de un bot multicelular ([[.multi]]). El motor
la vuelve a 0 después de usarla, pero el largo nuevo queda: alcanza con escribirla
una vez. Si el bot no tiene lazos, el valor queda escrito.

<!-- 21-MEMORIA §9.8 (reset tras el gate tienum/tiepres) -->

Un largo muy grande no estira el lazo sin límite: si los bots se separan más de
1000 de borde a borde, el lazo se corta. _Snap Tie bot_, del Bestiario, usa
justamente eso para moverse: pide un largo de 10000 y el lazo revienta.

<!-- 34-TIES §1 (borrado por longitud > 1000 + radios); Bestiario: Snap_Tie_bot.txt (10000 .fixlen); comprobado con probar-adn: con 10000 los dos se separan ~80 por ciclo y el lazo se corta al pasar los 1000 -->

```adn
' una vez multicelular, separarse 150 del compañero
cond
*.multi 1 =
start
150 .fixlen store
stop
```

[[.tielen]] muestra el largo real en cada ciclo.
