---
titulo: A bot that moves
resumen: "Your first bot from scratch, step by step: the minimal gene that moves forward, how to aim and turn, and a complete bot that roams the world turning every so often."
etiquetas: [tutorial, first bot, movement, turning, rnd]
estado: revisada
---
We're going to write your first bot from start to finish. We begin with the
smallest DNA that does anything, add turning, and end with a bot that roams the
world: it always moves forward and every so often turns to a new heading. Each
step adds one piece to the DNA and tells you what you should see. The full theory
of the language is in [[adn/estructura]] and [[adn/genes]]; here we write.

## Step 1: open a new bot {#paso-1}
<!-- i18n/es/bots.json (bots.nuevo «+ Nuevo bot»); i18n/es/editor.json (editor.guardar.*, editor.borrador.*); app/bots.md #nuevo -->

1. Go to the **Bots** section, in the top bar.
2. Click **+ New bot** and give it a name (for example, “Walker”).
3. The profile opens, on the **DNA** tab: that's the editor. As you type, it
   colors each class of word, autocompletes the names of the sysvars and
   immediately warns you about words that the engine would read differently from
   how they look (see [[app/editor]]).

There's no need to save all the time: the editor keeps a draft of what you type.
To record it as a version, use the **Save v…** button at the top, with its
**Version note** if you like.

## Step 2: the gene that moves forward {#avanza}
<!-- 20-VM §5.1-5.3 (cond vacía = verdadero; los stores solo corren en el cuerpo), §7 (store: dirección del tope, valor debajo) -->

Every bot that does anything has at least one _gene_, a piece of DNA with this
shape. Type:

```adn
' My first bot: always moves forward
cond
start
 10 .up store
stop
```

- [[op:cond]] opens the gene and starts the condition section. Between `cond` and
  `start` we put nothing, and a gene with no conditions always runs.
- [[op:start]] opens the body: what the gene _does_.
- `10 .up store` is a command. Numbers pile up like plates: first the 10, then
  the address [[.up]] (which is 1). [[op:store]] pops the top two and writes the
  value underneath at the address on top: it leaves 10 in `.up`. That's why you
  write `value address store`, never the other way around (the stack rules are in
  [[adn/pilas]] and [[adn/stores]]).
- [[op:stop]] closes the gene.

And `.up` is the sysvar that asks for a push forward, toward where the bot is
pointing. Writing to its memory is the only way a bot has of acting: moving,
turning, shooting and reproducing are always stores.

Note that `.up` goes without an asterisk: it's the address, a number. To read
what's in that cell you need the asterisk, `*.up` (the mix-up is a classic:
[[adn/errores#direccion]]).

## Step 3: seed it and watch it {#sembralo}
<!-- app/bots.md #sembrar (ficha → Sembrar; nombre, color, cantidad 5, energía 3000; «Sembrar en la corrida actual» / «Nuevo escenario con estos») -->

1. In the bot's profile, click **Seed**: the seeding dialog opens.
2. Leave **Number of bots** at 5 and **Starting energy** at 3000, and pick a
   **Color** that stands out.
3. Pick **Seed into the current run** if you have a world running (if there isn't
   one, the button is disabled), or **New scenario with these**, which opens it
   in Experiment so you can start it from there.

What you should see: the five bots head forward, faster and faster. When we ran
this DNA with the engine, the speed of one of them, cycle by cycle, was this:

| Cycle | 1 | 2 | 3 | 4 | 5 | 6 | 7 onward |
|---|---|---|---|---|---|---|---|
| Speed | 7 | 13 | 20 | 26 | 33 | 40 | 40 |

<!-- probado con probar-adn (costos 0): «cond start 10 .up store stop» da velscalar 7, 13, 20, 26, 33 y 40, y la posición cambia en cada ciclo; cada 10 .up suma ~6,6 de velocidad (30-FISICA §2.1, eficiencia opt:12 = 0,66; tope opt:11 = 40) -->

Two things to understand what you saw:

- **`.up` isn't a speed: it's a push.** Each one is added to the speed the bot
  already had, so by pushing every cycle it accelerates up to the simulation's
  cap (40 by default; the bot reads it in [[.maxvel]]). And since this world
  doesn't brake, if it stopped pushing it would keep gliding all the same
  ([[simulacion/fisica#fuerzas]]).
- **The command is carried out in the same cycle and isn't kept.** First the DNA
  of all the bots runs; then, in the _forces and collisions_ phase, the engine
  gathers the push you asked for, and in _movement_ it applies it and sets the
  cell back to 0. That's why the gene runs every cycle and asks for the push
  again. The whole order of the cycle is in [[simulacion/ciclo]].

<!-- 10-CICLO §2 (el ADN → se borran los sentidos → los disparos → fuerzas y choques → movimiento → acciones → nacimientos y muertes → el sol); sysvars.yaml .up -->

If a bot doesn't move, it's almost always one of three typing slips, and all three
are covered in [[empezar/preguntas#no-se-mueve]]: the `store` written backwards,
a misspelled sysvar, or the missing `start`.

To look at it up close, click on a bot. In the inspector, the **Summary** has
**Genes active this cycle** (here, gene 1 in all of them) and the **Memory** tab
lets you query any cell: in [[.up]] you'll always see 0, because the engine has
already used it; [[.aim]] tells you the heading (see [[app/inspector]]).

## Step 4: aim and turn {#girar}
<!-- sysvars.yaml .aim .setaim .aimsx .aimdx (rumbo al nacer: al azar); 30-FISICA §7 -->

A bot also has a _heading_: the direction it points and the direction `.up`
pushes. It's read in [[.aim]], on a scale where one full turn is 1256 units: 0 is
the right of the screen, 314 is up, 628 is left and 942 is down. Each bot is born
pointing in any direction.

There are two ways to turn it, and you'll see both in every Bestiary bot:

- [[.setaim]] turns _to_ an absolute heading: you write where you want it to
  point and it stays there. It accepts any number (it uses the remainder of
  dividing by 1256) and only acts if the requested heading differs from the
  current one.
- [[.aimsx]] and [[.aimdx]] turn _by_ an amount: 50 per cycle to the left or the
  right, respectively.

Try changing the body of the gene like this:

```adn
' Always aims up and moves forward
cond
start
 314 .setaim store
 10 .up store
stop
```

In our run, it turned to 314 in the first cycle and from then on it goes up;
writing 314 over and over doesn't make it shake. Note, though: the push is
computed with the heading from _before_ the turn, so the first push goes the old
way and only in the next cycle does it move toward where it asked. And since
nothing brakes it, the speed it had from the start keeps dragging it a little
sideways while it climbs.

<!-- probado con probar-adn: aim 314 desde el ciclo 1 y no oscila; el empujón sale con el rumbo previo (30-FISICA §2.1: VoluntaryForces usa el rumbo de antes del giro, y §7: el giro va después, en movimiento); con 628 .aimsx + 10 .up por ciclo, velup sale −7 respecto del rumbo nuevo -->

Now, turning at random. [[op:rnd]] replaces the number on top of the stack with
one drawn between 0 and that number, both included: `1256 rnd` gives any possible
heading.

```adn
' New random heading every cycle
cond
start
 1256 rnd .setaim store
stop
```

Run it, and it walks like a drunk: every cycle it heads off in a different
direction and barely gains speed. It's useful for seeing that turning is just one
more store; to really explore, it's better to turn every so often, not all the
time.

<!-- 20-VM §6.1 (rnd); probado: el rumbo cambia en cada ciclo -->

## Step 5: the complete bot {#el-bot}

This tutorial's bot always moves forward and every so often changes heading: a
long straight stretch, a turn, another straight stretch. It takes two genes:

```adn
' A bot that moves: goes forward and turns every so often

' Gene 1: always pushes forward
cond
start
 10 .up store
stop

' Gene 2: once in so many times, a new random heading
cond
  20 rnd 0 =
start
 1256 rnd .setaim store
stop
end
```

Gene 1 is the usual one. Gene 2 now has conditions, and takes advantage of the
fact that in the condition section everything runs except stores: `20 rnd` draws a
number between 0 and 20, and `0 =` asks whether 0 came up. It comes up one time
in 21 on average; the rest of the time, the body doesn't run and the bot keeps
going straight. When it does come up, the body picks a new random heading. To make
it turn more often, lower the 20; to make it turn less, raise it.

<!-- 20-VM §1 (en la zona de condiciones se ejecuta todo menos los stores), §6.1 (rnd); probado con probar-adn, 120 ciclos: rapidez 40, el rumbo 682 duró unos 30 ciclos y después cambió a 739, 790, 885…, unas cinco viradas en total -->

When we ran it for 120 cycles, it kept its speed at the cap and turned about five
times: it went straight for a stretch, changed heading, kept going, turned
again… What it doesn't do is dodge the edges: when it reached a wall it kept
pushing against it and sliding sideways until it got a heading that took it away.
If you want it to turn when it touches the edge, add a gene that turns while
[[.edge]] is 1: the example is in [[sysvars/movimiento]].

<!-- probado: contra el borde izquierdo quedó apretado unas 50 ciclos, deslizándose, hasta el rumbo nuevo; 30-FISICA §5 (los bots no rebotan: quedan contra la pared) -->

This “move forward and turn” skeleton is the one the Bestiary's explorers have
used for over twenty years. Jez's First bot 4G (March 2004), for example, turns
150 to the right every cycle while it sees nothing, and when it sees something it
moves forward and shoots; a fourth gene of his also turns if what it sees turns
out to be one of its own: your bot plus a pair of eyes, a shot and a
relative-dodger. The eyes are added in the next tutorial.
<!-- Bestiario: First_bot_4G_Jez_-04.03.04.txt (gen «*.eye5 0 =» → 150 .aimdx store; gen «*.eye5 0 >» → 10 .up store y −1 .shoot store; gen 4: «*.refeye 3 = *.eye5 0 !=» → 150 .aimdx store: vira al ver otro First bot, cuya firma marca .refeye en 3); 32-VISION -->

## What to try next {#despues}

- **Speed and friction.** The cap of 40 and the efficiency of the push are world
  settings, and friction, fluid or gravity completely change how a bot slides.
  The mechanism is in [[simulacion/fisica]] and you play with the values in
  [[app/experimentar]].
- **Energy and costs.** In the built-in scenarios, except F1 match, moving costs
  nothing. But where costs are turned on they're really charged: with the F1
  rules every push, every turn and every DNA instruction costs energy, and a bot
  that only moves forward can starve to death. How each thing is charged is in
  [[simulacion/energia]] (and watch out: the editor's quick test, **Test**, uses
  the F1 rules by default).
  <!-- simulacion/energia #mantenimiento (los escenarios de fábrica salvo Partido F1 con costos 0); 30-FISICA §2.1 (costo del empuje) y §7 (costo del giro); app/editor #probar (Reglas F1 por defecto y su aviso) -->
- **The next step**: give it eyes and something to hunt, in
  [[tutoriales/busca-comida]].
