---
titulo: .fertilized
resumen: "Avisa que el bot recibió esperma: mayor que 0 mientras la fecundación está vigente, cuenta hacia abajo desde 9."
etiquetas: [reproducción, sexual, esperma, sentido]
estado: revisada
---
<!-- 36-REPRO §3.1 (takesperm: fertilized = 10; ManageReproduction lo baja cada P5 y lo espeja en mem 303); comprobado: el primer valor leído es 9 -->
Cuando a un bot le llega un disparo de esperma (otro bot escribió `-8 .shoot store`
apuntándole), queda fecundado durante unos diez ciclos. `.fertilized` muestra la
cuenta regresiva: en el ciclo siguiente al impacto lee 9, después 8, y así hasta 0.
Si le llega otro esperma antes, la cuenta vuelve a empezar con el ADN nuevo.

Mientras sea mayor que 0, el bot puede tener un hijo escribiendo en [[.sexrepro]].
Después del parto vuelve a 0 enseguida: cada esperma da un solo hijo.

```adn
' Si está fecundada y tiene con qué, tiene el hijo
cond
 *.fertilized 0 >
 *.nrg 2000 >
start
 50 .sexrepro store
stop
```

<!-- 36-REPRO §1 (encola con sexrepro > 0 y fertilized ≥ 0, después de decrementar); leído en el port: el ADN que lee v encola si v − 1 ≥ 0; comprobado: la cuenta leída va de 9 a 0 y hay parto leyendo 3 -->
`*.fertilized 0 >` coincide justo con la ventana: el ciclo en que el ADN lee 0 ya es
tarde. También podés escribir `.sexrepro` de antemano: la orden queda escrita y se
usa apenas llegue un esperma.

<!-- 36-REPRO §0.3 (fertilized = −18 tras el rechazo); leído en el port: durante el bloqueo no se reescribe mem 303 y, al terminar, el contador queda en −2 sin reintentar -->
:::cuidado
Si el esperma resulta demasiado distinto (ver [[.sexrepro]]), no hay hijo y
`.fertilized` se queda congelada en el último número que mostró, aunque la
fecundación ya no sirva. Sigue así hasta que llegue otro esperma.
:::

<!-- 36-REPRO §1, §3.1 (mem 303 solo se escribe mientras el contador es ≥ 0); comprobado: 5 .fertilized store en el ciclo 3 queda en 5 y no hay parto -->
Escribir en `.fertilized` no fecunda al bot. Y fuera de una fecundación el motor no
la toca, así que el número que escribas se queda ahí y engaña a tus propias
condiciones: usá otra celda para tus cuentas. Más en [[simulacion/reproduccion]].
