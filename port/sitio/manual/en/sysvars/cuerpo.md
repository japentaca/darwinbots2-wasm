---
titulo: Body, energy and state
resumen: "The sysvars that describe the bot itself: energy, body, mass, age, clock, kills and waste, plus the commands to move energy into body and back."
etiquetas: [energy, body, age, waste, buoyancy]
estado: revisada
---
This group is the bot's dashboard: what the engine tells it about itself at the end
of every cycle, plus a couple of commands to manage its reserves. The most-read
sysvars in all of DarwinBots are here: almost any bot has some condition on
[[.nrg]] or [[.body]].

<!-- 31-ENERGIA §0.3 (body↔nrg 10:1, tope 100/ciclo); §1 (muerte energética) -->
A bot keeps its wealth in two currencies. **Energy** ([[.nrg]]) is the one that
gets spent: every instruction, every movement, every shot consumes it, and if it runs out the
bot dies. **Body** ([[.body]]) is a slower reserve that also makes it
bigger and heavier ([[.mass]]). Between the two there is a fixed exchange rate of 10 to 1:
[[.strbody]] stores 100 of energy as 10 of body, and [[.fdbody]] does the
reverse. With that you can build a piggy bank, as in this bot:

```adn
' Keeps energy between 2000 and 5000 using body as a reserve
cond
 *.nrg 5000 >
start
 100 .strbody store
stop
cond
 *.nrg 2000 <
 *.body 100 >
start
 100 .fdbody store
stop
```

<!-- sysvars.yaml .robage .timer .kills .waste .pwaste .setboy .rdboy; 31-ENERGIA §2 -->
The rest of the group is clocks and counters: [[.robage]] (the age, which starts at
0), [[.timer]] (a clock that is inherited from parent to child and that you can write) and
[[.kills]] (how many you have killed). [[.waste]] and [[.pwaste]] measure waste, which
in excess corrupts the bot's memory. [[.setboy]] and [[.rdboy]] handle
buoyancy in pond mode.

<!-- 21-MEMORIA §0.3 (latencia de un ciclo); comprobado en el port: un bot sembrado lee .nrg, .body, .mass y .robage en 0 en su primer ciclo, y .timer con un valor al azar -->
The senses in this group arrive one cycle late, and a freshly loaded bot
reads them as 0 in its first cycle (except [[.timer]], which starts at random):
`*.nrg 500 <` is true there even if it has plenty of energy. How energy is charged and gained is covered in
[[simulacion/energia]]; the changes from one cycle to the next, in
[[sysvars/ganancias]].
