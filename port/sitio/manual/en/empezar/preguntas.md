---
titulo: Frequently asked questions
resumen: "Short answers to the most common questions when using the app and writing bots: bots that don't move, populations that die out or don't evolve, where your data lives and what differs from the original."
etiquetas: [questions, problems, help, data, original]
estado: revisada
---
## About the simulation {#simulacion}

### Why doesn't my bot move? {#no-se-mueve}
<!-- probado con probar-adn (costos 0): «cond start .up 10 store stop», «cond start 10 .upp store stop» (lint: did you mean .up?) y «cond 10 .up store stop» quedan quietos 3 ciclos; «cond start 10 .up store stop» avanza. adn/errores #nombre #start-stop #direccion -->

It's almost always one of these three things, and we tested all three with the
engine:

| You wrote | What happens | It should be |
|---|---|---|
| `.up 10 store` | [[op:store]] takes the value from below and the address from above: this writes something else somewhere else. | `10 .up store` |
| `10 .upp store` | A misspelled sysvar is worth 0 and the command doesn't arrive. The editor warns you: “.upp is not a sysvar: the engine reads it as 0. Did you mean .up?”. | `10 .up store` |
| `cond 10 .up store stop` | Without `start`, the command stays in the condition section and writes nothing. | `cond start 10 .up store stop` |

If the DNA looks right, inspect the bot: in **Summary**, **Genes active this
cycle** shows whether the gene that moves is running, and in **Memory** you can
check [[.up]] (see [[app/inspector]]). A movement command is cleared every
cycle, so you have to give it in every one (see
[[simulacion/ciclo#atraso]]). More typical mistakes are in [[adn/errores]].

### Why does everyone die? {#se-mueren}
<!-- probado con probar-adn y los costos F1 de opciones.js (F1_COSTOS): un bot quieto pierde unos 0,02 de energía por ciclo y uno que avanza y gira (el de primera-simulacion), unos 0,63; con costos 0 el quieto conserva 3000 en 2000 ciclos. Revisor: el bot de primera-simulacion con F1_COSTOS baja de 3000 a 2372,57 en 1000 ciclos (0,63 por ciclo). muerte #causas (umbral 15 con cadáveres) -->

A bot dies when it runs out of energy (see [[simulacion/muerte#causas]]). The
most common causes:

- **The world charges costs and there's no food.** With the F1 league costs
  (the F1 match scenario, or **Costs** set to “F1”), a bot that moves spends
  energy all the time; in one test, the bot from
  [[empezar/primera-simulacion#tu-bot|your first simulation]] lost about 0.6
  per cycle without eating. If it can't find anything to eat, it dies out in a
  few thousand cycles.
- **The vegetables ran out.** If the animals eat all the algae, they're left
  without food. Raise **Solar energy** or **Vegetable repopulation** in
  Experiment (see [[simulacion/cloroplastos#vegetales]]).
- **It's night.** With **Day and night** turned on, vegetables get no energy
  while the night lasts.
- **There's a predator.** Look at the events and the population chart: if one
  species grows while another falls, it's hunting it.

In the built-in scenarios, except F1 match, costs are 0: there, nobody loses
energy just for living, and almost every death is a bot that was hunted.

### Why doesn't my bot reproduce? {#no-se-reproduce}
<!-- reproduccion #cuando-falla; .repro -->

Check that the gene that writes [[.repro]] is running (the energy condition is
usually the culprit) and that the bot has some energy and body. The most
common reason is that the spot where the child would be born is occupied: a
sibling right next to it, a wall or the edge of the field. The command stays
written and is retried every cycle. The full list is in
[[simulacion/reproduccion#cuando-falla]].

### Why don't they evolve? {#no-evolucionan}
<!-- mutaciones #quien-muta #mrepro #encender; opciones.js F1_NOMBRADAS mutations: 0 (Partido F1, Ajustes F1); dbcore_api.cpp db_sim_add_species con tasas de fábrica (commit 175f691) -->

- **Mutations are off.** Check the **Mutations** control in Experiment. The F1
  match scenario and the **F1 settings** button turn them off.
- **It takes time.** With the factory rates, a child born with [[.repro]] comes
  out changed only once in a great while (in a bot of 20 instructions, about 1
  in 60), and most of those changes break something. Evolution shows up over
  tens of thousands of cycles: set the speed to **Max**.
- **They don't reproduce.** Without births there are no mutations to inherit.

To speed things up, a bot can reproduce with [[.mrepro]], which makes that
child mutate ten times more. All of this is in [[simulacion/mutaciones]], and a
guided experiment is in [[tutoriales/evolucion]].

### Why does the simulation slow down? {#lenta}
<!-- observar.ritmo (ciclos/s · fps); probado: sin costos, 5 bots de primera-simulacion pasan de 5 a entre 166 y 1198 en 10000 ciclos según la semilla (redactor semillas 1-3, revisor 2 y 4-7) -->

Because there are a lot of bots: each one runs its DNA and moves in every
cycle. Without costs nobody starves, so a species that eats well grows without
limit. On the right of the Observe bar you can see how many cycles per second
you're getting. To hold the population back, charge costs or lower the
**Vegetable cap** and **Solar energy** (see [[app/experimentar]]).

### Can I repeat exactly the same simulation? {#repetir}
<!-- experimentar.semilla.ayuda; web2/PLAN.md C15, C17, C19 -->

Yes: the same scenario with the same seed gives the same simulation. The seed
is shown and changed in Experiment. A saved run that you resume carries on
fine, but not identically to how it would have gone on without being saved. See
[[tecnico/semillas]].

## About the app {#app}

### Where is my data kept? {#datos}
<!-- i18n/es/inicio.json inicio.nota; observar.guardar.explica; web2/PLAN.md decisión 17; PLAN-SITIO.md S3 -->

In the browser you use, on that computer. Your bots, runs, scenarios,
tournaments and reports aren't uploaded to any server. That means:

- in another browser or on another computer you won't see them;
- if you clear the site's data from the browser, they are lost;
- only the last 20 runs are kept.

To keep them safe or take them somewhere else, export them: **Download
.dbsim** when you save a run, **Export my bots and marks (.json)** in Bots,
**Export** in scenarios and in tournaments. It's all in [[app/tus-datos]].

### I had bots and tournaments in the classic interface. Do I lose them? {#clasica}
<!-- web2/PLAN.md decisión 17; i18n/es/bots.json bots.menu.clasica, competir.json competir.lista.archivos -->

No. The first time you open the new app, it copies the bots and tournaments you
had saved in the classic one and tells you what it imported; the classic one is
left untouched. You can also repeat it from the library menu, with **Import
from the classic interface**, and Compete accepts the tournament files exported
from the classic one. See [[app/clasica]].

### Can I use a bot from the original DarwinBots? {#bot-original}
<!-- port/README.md (Bugs del original corregidos: el lenguaje no cambia; A2-1, 9 bots de web/bots; 571 bots cargan y corren); inicio.archivo.desc; observar.sembrar.preset.pegar -->

Yes. The DNA language is the same: a bot written for 2.48.32 loads and runs its
DNA as in the original. You have three ways:

1. On Home, the **From a file** card: choose the `.txt` and it is seeded into
   the default world, with algae.
2. In Observe, **Seed** › **Paste the DNA…**.
3. In Bots, **+ New bot**, to save it in your library and edit it.

Before looking for it, check whether it's already in the Bestiary: the app
ships 684 bots from the forum and the wiki. The only language rule that changed
is the `else` after a `start`, which in the original never ran and in this
version does (see [[adn/genes#else]]). What does change a little is the world,
because of the fixed bugs (see the next question).

### How does it differ from the original? {#diferencias}
<!-- port/README.md Bugs del original corregidos (35 corregidos, conservados y por qué); web2/PLAN.md decisión 5 -->

The engine is the same program, translated. We fixed 35 bugs in the original
that could be fixed without changing the DNA language: a sense that was always
worth 0, energy that was destroyed instead of passing to the body, virus shots
that were charged twice, and others. That's why the numbers in a simulation
don't exactly match those of the original. The complete list, with what was
deliberately left as it was, is in [[tecnico/diferencias]].

In the interface, the new app is different from the Windows program, and some
things from the original were left out (such as custom drawings for the bots or
the background image). The classic interface is closer to the original: see
[[app/clasica]].

### The app says “N DNA words are not recognized and are worth 0”. {#aviso-lint}
<!-- observar.aviso.lint; corrida-nucleo.js (evento lint del worker al sembrar); adn/errores #nombre -->

When you seed a species, the app checks its DNA. If there are words that are
neither numbers, nor sysvars, nor operators (almost always a misspelled
sysvar), it tells you how many. The bot is seeded anyway, but those words are
worth 0. Open it in the [[app/editor|DNA editor]] to see which ones they are:
it marks each one with its line and, when it can, suggests the right name. See
[[adn/errores#nombre]].

### Why does my bot shoot members of its own species? {#especie}
<!-- adn/errores #especie; sysvars/my -->

Because the DNA doesn't know about species: it shoots whatever is in front of
it. You have to add a signature comparison to the shot's condition, such as
`*.refeye *.myeye !=` (“the signature of what I see isn't mine”). See
[[adn/errores#especie]] and [[tutoriales/reconoce-especie]].

### Where do I learn to write bots? {#aprender}

Start with [[adn/estructura]] and follow the tutorials in order, beginning with
[[tutoriales/se-mueve]]. The [[app/editor|DNA editor]] warns you about errors
as you write, and with **Test** you see how your bot does without leaving its
profile.
