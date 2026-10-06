---
titulo: .refbody
resumen: "The body of the bot you are looking at, from 0 to 32000: its size, and what you can take from it with a body shot."
etiquetas: [vision, refvars, body]
estado: revisada
---
<!-- sysvars.yaml 688; 32-VISION §2; 33-SHOTS §5 (-6 releasebod: corpse ×4); 30-FISICA §0.4 (masa = body/1000 + shell/200 + cloroplastos) y FindRadius (radio según body) -->
`.refbody` is the body of the bot your focus eye sees, what that bot reads in its
[[.body]]. Almost all of its mass and its size depend on the body, and it is what a
body shot takes ([[.shoot]] at −6).

A corpse keeps its real body (and its [[.refnrg]]), even though its DNA signature
is 0. So something with body and [[.refeye]] at 0 is usually a corpse or
a bot that doesn't look, like many vegetables. And body shots against a
corpse pay off more than against a live bot (see [[simulacion/disparos]]).

If you see nothing, it is 0.

```adn
' something big that doesn't read its eyes: I take body from it
cond
*.eye5 0 >
*.refeye 0 =
*.refbody 500 >
start
-6 .shoot store
stop
```
