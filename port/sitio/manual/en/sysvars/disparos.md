---
titulo: Shots
resumen: "The sysvars for shooting (.shoot, .shootval, .backshot, .aimshoot) and the ones that tell you when a shot hits you (.shflav, .shang and the four direction ones)."
etiquetas: [shots, attack, defense, senses]
estado: revisada
---
<!-- 33-SHOTS §0-§3; 32-VISION §5 (taste); 21-MEMORIA §3 (régimen A y C); probado: tira.txt contra blanco.txt, gira.txt -->
Shooting is how almost every bot that isn't a vegetable eats, and
also how it attacks, gifts energy or writes into another bot's memory. This
group has two halves.

**For shooting.** [[.shoot]] is the command: the number you write picks the
shot type, and the engine fires it in that same cycle. The most common is −1,
which takes energy from whoever receives the hit and brings it back to you.
[[.shootval]] tunes the shot: the power, the range, the amount you
gift or the value you write. [[.backshot]] shoots backward and
[[.aimshoot]] offsets the shot by an angle, without you having to turn.

**For sensing the shots that hit you.** [[.shflav]] says what type it was,
[[.shang]] from what angle it came, and [[.shup]], [[.shdn]], [[.shdx]] and
[[.shsx]] repeat the type in the one matching the side of the hit (front,
back, right or left). They arrive one cycle late and last a single
cycle. Watch out: they also register the shots that favor you, such as the energy
that comes back from your own attacks.

A classic combination joins the two halves: the one under attack turns toward the
attacker and returns fire.

```adn
' if something hits me that isn't my own energy coming back, I turn and shoot
cond
*.shflav 0 !=
*.shflav -2 !=
start
*.shang .aimdx store
-1 .shoot store
stop
```

How a shot flies, how far it reaches and what each type does on impact is covered in
[[simulacion/disparos]]; the step-by-step walkthrough for a hunter bot, in
[[tutoriales/dispara]].
