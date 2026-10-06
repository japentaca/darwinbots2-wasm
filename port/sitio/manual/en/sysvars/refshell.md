---
titulo: .refshell
resumen: "How much shell the bot you are looking at has: the shell stops venom and body shots."
etiquetas: [vision, refvars, defenses, shell]
estado: revisada
---
<!-- sysvars.yaml 687; 33-SHOTS §5 (-3 takeven y -6 releasebod: el shell absorbe); core senses.hpp lookoccurr -->
`.refshell` is the shell of the bot your focus eye sees: what that bot reads
in its [[.shell]] and makes with [[.mkshell]]. It goes from 0 to 32000.

The shell doesn't stop energy shots, but it does stop venom shots
([[.shoot]] at −3), which are worth very little against it, and body shots (−6). So
`.refshell` is useful for choosing the weapon: if the other is armored, better
energy than venom. The details for each type are in
[[simulacion/defensas]].

If you see nothing, or what you see is a shape, it is 0.

```adn
' without a shell, venom; with a shell, energy
cond
*.eye5 0 >
*.refeye *.myeye !=
*.refshell 0 =
start
-3 .shoot store
stop

cond
*.eye5 0 >
*.refeye *.myeye !=
*.refshell 0 >
start
-1 .shoot store
stop
```
