---
titulo: .fertilized
resumen: "Signals that the bot received sperm: greater than 0 while the fertilization is in effect, counting down from 9."
etiquetas: [reproduction, sexual, sperm, sense]
estado: revisada
---
<!-- 36-REPRO §3.1 (takesperm: fertilized = 10; ManageReproduction lo baja cada P5 y lo espeja en mem 303); comprobado: el primer valor leído es 9 -->
When a sperm shot reaches a bot (another bot wrote `-8 .shoot store` aiming at
it), it is fertilized for about ten cycles. `.fertilized` shows the countdown:
in the cycle after the impact it reads 9, then 8, and so on down to 0. If
another sperm arrives before that, the count starts over with the new DNA.

While it is greater than 0, the bot can have a child by writing to
[[.sexrepro]]. After the birth it goes back to 0 right away: each sperm gives
only one child.

```adn
' If fertilized and it has the means, it has the child
cond
 *.fertilized 0 >
 *.nrg 2000 >
start
 50 .sexrepro store
stop
```

<!-- 36-REPRO §1 (encola con sexrepro > 0 y fertilized ≥ 0, después de decrementar); leído en el port: el ADN que lee v encola si v − 1 ≥ 0; comprobado: la cuenta leída va de 9 a 0 y hay parto leyendo 3 -->
`*.fertilized 0 >` matches the window exactly: the cycle in which the DNA reads
0 is already too late. You can also write `.sexrepro` beforehand: the command
stays written and is used as soon as a sperm arrives.

<!-- 36-REPRO §0.3 (fertilized = −18 tras el rechazo); leído en el port: durante el bloqueo no se reescribe mem 303 y, al terminar, el contador queda en −2 sin reintentar -->
:::cuidado
If the sperm turns out to be too different (see [[.sexrepro]]), there is no
child and `.fertilized` stays frozen at the last number it showed, even though
the fertilization is no longer of any use. It stays that way until another sperm
arrives.
:::

<!-- 36-REPRO §1, §3.1 (mem 303 solo se escribe mientras el contador es ≥ 0); comprobado: 5 .fertilized store en el ciclo 3 queda en 5 y no hay parto -->
Writing to `.fertilized` does not fertilize the bot. And outside a fertilization
the engine does not touch it, so the number you write stays there and fools your
own conditions: use another cell for your counts. More in
[[simulacion/reproduccion]].
