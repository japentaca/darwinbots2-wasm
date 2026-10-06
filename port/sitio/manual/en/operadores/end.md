---
titulo: end
resumen: "Ends the DNA: whatever comes after it does not run. The engine adds one at the end if you do not."
etiquetas: [end, ending, flow]
estado: revisada
---
<!-- 20-VM §2.2 (el cargador añade siempre end; un end en medio no corta la carga), §2.6 (DnaLen hasta el primer end), §4 (el bucle para en el primer end); opcodes.yaml flujo_maestro; comprobado en el port -->

`end` marks the end of the DNA: each cycle's execution stops at the first `end`
it finds. You do not need to write it, because when the bot is loaded the engine
adds one at the end. It also costs no energy.

If you put an `end` in the middle, what follows is still loaded but does not
run:

```adn
' the second gene is after the end and does not run
start
 1 50 store
stop
end
start
 2 51 store
stop
```

Cell 50 holds 1 and cell 51 stays at 0. What comes after also does not count in
[[.dnalen]], which measures the DNA up to the first `end` (here, 6 words
counting the `end`), nor in [[.genes]], which is 1.

It is useful for switching off the final part of a bot in one go while you test
it, without deleting it. What remains after the `end` is still part of the bot's
DNA (mutations can touch it), it just does not run.
