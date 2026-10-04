---
titulo: .vtimer
resumen: "La cuenta regresiva del virus en incubación: 0 si no hay virus, baja de a 1 por ciclo y se detiene en 1 hasta el disparo."
etiquetas: [virus, sentido, reloj]
estado: revisada
---
<!-- 35-VIRUS §0.3, §2 (Vtimer = 2·largo, baja cada P3, se detiene en 1) -->
Cuando el bot fabrica un virus con [[.mkvirus]], el motor fija la incubación en el
doble de palabras del gen copiado y la va bajando de a 1 por ciclo. `.vtimer`
muestra esa cuenta:

| Valor | Qué significa |
|---|---|
| 0 | No hay virus: se puede fabricar uno. |
| más de 1 | Hay un virus incubando. |
| 1 | El virus está listo y espera un [[.vshoot]]. |

Al disparar vuelve a 0. Si nunca escribís `.vshoot`, se queda en 1 para siempre y el
bot no puede fabricar otro virus.

<!-- sysvars.yaml .vtimer (se publica al empezar BotDNAManipulation, antes de fabricar); comprobado: el ciclo siguiente a la orden lee 0 y después 23, 22… -->
Como todo sentido, llega con un ciclo de atraso: el ciclo siguiente a la orden de
`.mkvirus` todavía lee 0, aunque el virus ya esté incubando. No es grave, porque una
segunda orden no fabrica nada mientras haya un virus, pero si la condición sobre
`*.vtimer 0 =` hace algo más que pedir el virus, se va a ejecutar dos veces.

No se puede escribir: el motor la reescribe cada ciclo.

```adn
' Dispara el virus apenas está listo, con más fuerza si tiene energía
cond
 *.vtimer 1 =
 *.nrg 5000 >
start
 100 .vshoot store
stop
cond
 *.vtimer 1 =
 *.nrg 5000 <=
start
 20 .vshoot store
stop
```
