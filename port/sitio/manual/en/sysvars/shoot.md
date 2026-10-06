---
titulo: .shoot
resumen: "The order to fire: the number picks the shot type (−1 steals energy, −2 gives it away, −3 venom, −6 steals body, positive writes to the other bot's memory)."
etiquetas: [shots, attack, action]
estado: revisada
---
<!-- 33-SHOTS §0.3-0.4, §2.1 (tabla de tipos, -8 esperma, -5 no disparable), §2.2 (40 + actvel; Range = (ln(vbody)·60+41) div 40 = 11 con body 1000), §3; sysvars.yaml 7; README B3-1, B3-2; core shots.hpp robshoot/newshot, robots.hpp Shooting; probado: tira.txt, memshot.txt (1050 escribe en la 50), sperm.txt (1000 da shflav -8), m9.txt (-9 no dispara); revisor: tira.txt contra blanco.txt en 1200x900 (ve en el ciclo 6; en el 8 el blanco pierde 198 y el tirador gana 209); core robshoot (nrg <= 0 sale sin disparar; default: -5, -7) -->
Writing a number other than 0 to `.shoot` fires, in this same cycle, a
projectile that leaves your front in the direction of [[.aim]]. Afterwards the engine
always sets it back to 0, whether or not the shot went out: to shoot every cycle
you have to write it every cycle.

The number picks the type:

| Value | Shot | What it does on hit |
|---|---|---|
| −1 | energy | takes energy from the other bot, which comes back to you |
| −2 | energy gift | gives the other bot some of your energy |
| −3 | venom | paralyzes it; uses up your [[.venom]] |
| −4 | waste | passes your waste ([[.waste]]) to it |
| −6 | body | takes body from it (and some energy), which comes back to you as energy |
| −8 | sperm | fertilizes it with your DNA (see [[simulacion/reproduccion]]) |
| positive | memory | writes your [[.shootval]] to that address in its memory |

A memory shot uses the number modulo 1000: `1050 .shoot store` writes
to address 50. Address 340 ([[.delgene]]) is protected. And an exact
multiple of 1000 gives 0, which the engine turns into a sperm shot. Negatives
that aren't in the table, like −5, −7 or −9, don't fire anything. If your energy
is 0, nothing goes out either.

The shot goes out with a small random deviation, travels at 40 units per
cycle plus your own speed, and its range grows with your body: with 1000
body it lasts about 11 cycles. It costs energy according to the simulation's
configuration. It never hits you yourself, but it does hit any other bot, including
your own species (see [[adn/errores#especie]]).

```adn
cond
*.eye5 0 =
start
40 .aimdx store
stop

cond
*.eye5 0 >
start
-1 .shoot store
stop
```

In a test with a stationary bot in sight, this bot found it in 6 cycles;
two cycles later the target had lost 198 energy and the shooter had
gained 209. [[.shootval]], [[.backshot]] and [[.aimshoot]] modify the shot;
what each type does in detail is in [[simulacion/disparos]].
