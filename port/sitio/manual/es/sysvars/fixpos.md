---
titulo: .fixpos
resumen: "Clava al bot en su lugar mientras valga más de 0; con 0 o un negativo lo suelta."
etiquetas: [fijo, orden, movimiento]
estado: revisada
---
<!-- sysvars.yaml .fixpos (latch, nunca la borra el motor) -->
`.fixpos` es un interruptor: con un valor mayor que 0 el bot queda anclado, con 0 o
negativo queda libre. A diferencia de las órdenes de movimiento, el motor nunca la
borra: lo que escribís queda hasta que lo cambies, así que alcanza con escribirla
una vez. El estado efectivo se lee en [[.fixed]].

<!-- 30-FISICA §2 (gate Not Fixed), §4.3 (fijo = masa 32000; separación posicional), §7 -->
Un bot anclado no recibe ninguna fuerza: ni sus propios empujones con [[.up]] (que
tampoco le cobran energía) ni la gravedad. En un choque su velocidad no cambia y
cuenta como un cuerpo muy pesado, aunque el motor igual puede correrlo un poco para
separar a los dos bots si se superponen. Sí puede girar con [[.aimsx]], [[.aimdx]]
o [[.setaim]], y ver o disparar con normalidad.

<!-- sysvars.yaml .fixpos (DisableFixing; semilla 1 si la especie es Fixed) -->
La simulación puede tener desactivada la fijación; en ese caso `.fixpos` no hace
nada. Algunas especies arrancan con `.fixpos` en 1 porque así lo marcó quien las
cargó en la simulación.

```adn
' se queda quieto a partir de los 100 ciclos de vida
cond
*.robage 100 >
start
1 .fixpos store
stop
```

Para soltarlo de nuevo alcanza con `0 .fixpos store`.
