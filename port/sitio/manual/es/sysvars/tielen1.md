---
titulo: .tielen1
resumen: "Largo del primer lazo de un multicelular, de borde a borde; escribirlo fija el largo natural de ese lazo."
etiquetas: [lazos, multicelular]
estado: revisada
---
Es una celda de ida y vuelta para el **primer lazo** del bot (el más antiguo que
le queda; si se corta uno, los siguientes corren un lugar), y solo funciona si el
bot es multicelular ([[.multi]]) y ese lazo está endurecido.

<!-- sysvars.yaml .tielen1 (bidi: TieLenOverwrite → NaturalLength = valor + radios en ambos extremos; P3 publica CInt(dist − radios)) -->

**Leer.** En cada ciclo el motor publica la distancia al compañero descontando
los dos radios. Se mide antes de mover a los bots, así que puede diferir un poco
de [[.tielen]].

**Escribir.** Un valor escrito con [[op:store]] (o con otro store de dos
operandos) se vuelve el largo natural del lazo, de borde a borde, para los dos
extremos, igual que [[.fixlen]] pero sin elegir el lazo con [[.tienum]]. A
diferencia de `.fixlen`, acá el signo cuenta: un negativo pide que los bots se
superpongan. Después el motor vuelve a escribir la medición en la celda. Con
[[op:inc]] o [[op:dec]] el lazo no se entera (ver [[adn/stores]]).

<!-- port/core ties.hpp Update_Ties (sin Abs, a diferencia de fixlen); 20-VM §7 -->

Si el bot no es multicelular o el primer lazo no está endurecido, el motor no toca
la celda.

```adn
' mantener el primer lazo a 150
cond
*.multi 1 =
start
150 .tielen1 store
stop
```

Con un hijo atado al padre, una vez endurecido el lazo la distancia pasa de casi
0 a unos 150: se pasa de largo al principio y después queda oscilando entre unos
115 y 175. El ángulo del mismo lazo es [[.tieang1]].

<!-- comprobado con probar-adn: hijo atado al padre con 150 .tielen1 store; .tielen1 llega a 215 y después oscila entre 116 y 174 -->
