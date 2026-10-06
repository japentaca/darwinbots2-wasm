---
titulo: .trefbody
resumen: "The body of the tied bot at the other end of the tie you're reading."
etiquetas: [tref, ties, body]
estado: revisada
---
<!-- sysvars.yaml .trefbody (CInt(body), tope 32000); 34-TIES §2; corte del lazo: valor viejo un ciclo, comprobado con probar-adn -->
It holds the [[.body]] of the tied bot, rounded to an integer. If the other one has 32000
or more body, you read 32000. Like all the [[sysvars/tref|tref*]], it describes the bot on the tie
chosen with [[.readtie]] (or the one in [[.tiepres]]) and goes back to 0 when that tie no longer
exists.

It's for comparing sizes within a tied group: deciding who eats, who reproduces
or who passes resources to whom. Together with [[.trefnrg]] it gives you the
partner's complete state.

```adn
' Fattens up while the tied bot has more body than I do
cond
*.numties 0 >
*.trefbody *.body >
start
100 .strbody store
stop
```

The guard `*.numties 0 >` avoids using the stale value that remains during the cycle in
which the tie is broken (see [[sysvars/tref#que-lazo]]).
