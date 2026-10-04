---
titulo: .refkills
resumen: "Cuántos bots mató el bot que estás viendo: una forma de reconocer a un depredador."
etiquetas: [visión, refvars, depredadores]
estado: revisada
---
<!-- sysvars.yaml 715; README A3-5 (tope 32000 también por la vía de shots); core senses.hpp lookoccurr; sysvars.yaml 220 (kills: sube al matar por ties o por shots) -->
`.refkills` es la cuenta de muertes del bot que ve tu ojo con foco: lo que ese
bot lee en su [[.kills]]. Sube cada vez que uno de sus disparos o lazos deja a
otro bot sin energía o sin body.

Un valor mayor que 0 dice que el otro ya mató a alguien: es un depredador, o
al menos un bot que dispara en serio. Sirve para huir, o para ponerte a la
defensiva (ver [[simulacion/defensas]]). Lo mismo te dice, con menos certeza,
[[.refshoot]], que solo indica si el otro _sabe_ disparar.

En este port la cuenta tiene tope en 32000. Si no ves nada, vale 0.

```adn
' un asesino a la vista: media vuelta y a correr
cond
*.eye5 0 >
*.refkills 0 >
start
628 .aimdx store
30 .up store
stop
```
