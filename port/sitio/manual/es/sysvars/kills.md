---
titulo: .kills
resumen: "Cuántos bots mató este bot, con disparos o por un lazo; el motor la actualiza solo cuando mata."
etiquetas: [muertes, depredador, sentido]
estado: revisada
---
<!-- sysvars.yaml .kills (solo al matar, vía lazos y disparos); port/README A3-5 (tope 32000 también por disparos) -->
Cuenta las víctimas del bot: cada vez que un disparo suyo o lo que le saca a otro
por un lazo deja a ese otro sin energía o sin cuerpo, el motor suma 1 y lo escribe
acá. El tope es 32000 (en el DarwinBots original, la cuenta por disparos no lo
tenía; el port lo corrigió).

Lo particular es que el motor **solo la escribe cuando el bot mata**. El resto del
tiempo no la toca, así que si escribís otro número en `.kills` queda ahí hasta la
próxima muerte, y en ese momento el motor vuelve a poner su cuenta propia (que no
se enteró de tu cambio). No sirve, entonces, para llevar una cuenta propia: para
eso usá una celda de memoria libre.

Un hijo nace con `.kills` en 0: las muertes no se heredan.

```adn
' Después de la primera víctima, guarda energía en el cuerpo
cond
 *.kills 0 >
 *.nrg 3000 >
start
 100 .strbody store
stop
```

Las muertes del bot que tenés enfrente se leen en [[.refkills]]: un número alto
avisa que eso es un depredador. Cómo se mata con disparos está en
[[simulacion/disparos]], y con lazos en [[simulacion/lazos]].
