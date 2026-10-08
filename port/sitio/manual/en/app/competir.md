---
titulo: Compete
resumen: "Matches and tournaments between bots: the quick match, the tournament wizard, the six formats, the match rules, the standings with Elo, seasons, the Hall of Fame and how to play."
etiquetas: [tournaments, compete, elo, match, play]
estado: revisada
---
In **Compete**, bots fight each other under fixed rules and the app keeps count:
who won each match, with which seed, the season standings and an Elo that carries
over from one tournament to the next. It is for finding out whether your bot is
better than another, and not just watching it for a while in [[app/observar]].

<!-- web2/src/screens/Competir.svelte; i18n/es/competir.json; PLAN.md decisiones 21-23 -->

The screen has three columns:

- **On the left**, the list: **New tournament**, the **⚡ Quick match**, **My
  tournaments** and, at the bottom, the **Hall of Fame**, with **Import .json** and
  **Export**.
- **In the middle**, the open tournament: its name, the format, how many bots and
  which season it is in, and its tabs.
- **On the right**, **Play**: the next fight, the buttons to play it and the last
  match.

## Matches, rounds and seasons {#conceptos}
<!-- competir.campo.rounds.ayuda, competir.regla.*, competir.campo.cap.ayuda; engine/rondas.js (escenario efectivo: reglas + alga de arranque + luchadores); partido.js ALGA_ARRANQUE -->

Three words used throughout the section:

- A **round** is a new world with the fighters seeded. The last species standing
  wins it. If the round reaches the cycle cap, the species with the most bots or
  the most energy wins it, depending on the rule you pick.
- A **match** is a series of rounds. With _N_ minimum rounds, whoever collects more
  than √N + N/2 round wins takes the match. If nobody gets there, another round is
  played. With **Wins to take the match**, the first species to reach that number
  takes the match right away.
- A **season** is one full pass of the format: all the matches needed to have a
  champion. A tournament can have many seasons.

In every round, besides the entrants, the world starts with 15 algae (Alga
Minimalis) seeded as vegetables, just like in the classic interface. The algae
don't count as fighters, and vegetable bots can't be entered.

## The quick match {#rapido}
<!-- competir.rapido.*; engine/torneos.js «El Scratch no se guarda (vive en memoria hasta Save as tournament)» -->

The **⚡ Quick match** is for trying things out without setting anything up:
everyone together in one world, up to 20 bots. It isn't saved. If you reload the
page, it is lost.

1. Click **⚡ Quick match** in the list.
2. In the **Entrants** tab, click **Add from the Library**, search for the bots
   and click **Add**.
3. In **Play**, click **▶ Play**.

If you like the result, type a name and click **Save as tournament**: it moves to
**My tournaments** with its matches. **Clear** removes the entrants and the
matches.

You can also enter a bot from its profile, with **Enter in a tournament** (see
[[app/bots#torneo]]).

## Creating a tournament {#asistente}
<!-- lib/competir/Asistente.svelte, asistente.js (nuevoAsistente: suizo, lista fija, pool all, n 8, reglas F1); competir.nuevo.*, competir.entrantes.* -->

**New tournament** opens a three-step wizard. At the bottom you have **Back**,
**Cancel** and the button to continue.

1. **1 · Format.** Pick how they meet (see the table below) and fill in its
   options. The **Name** is optional: left empty, it becomes “Tournament N”.
2. **2 · Entrants.** Pick the mode:
   - **Fixed list**: the ones you pick. They carry over unchanged to the next
     season.
   - **Drawn every season**: N bots from the pool, drawn again every season.
   - **Drawn every fight**: the fighters come out of the pool when each fight is
     played. The World cup doesn't allow this mode.

   The bots come from the [[app/bots|Library]]: search them by name, filter by
   **Origin** (**from the forum** or **my own**), add a saved selection with **Add
   a selection…** or draw N with **🎲 Draw**. The _pool_ can be the whole Library,
   your favorites, the current selection, a tag or a named selection.
3. **3 · Rules.** Pick the world and the match values (see
   [[app/competir#reglas|below]]).

**Create the tournament** saves it and opens it. The wizard warns you if
something doesn't add up. For example, a World cup needs 8, 16 or 32 entrants, and
in a round robin with many bots it tells you how many matches there will be.

:::nota
Each entrant's DNA **is frozen when it joins**. If you edit the bot afterwards,
the tournament keeps going with the version it had. That way replays of old
matches stay valid.
:::

## The formats {#formatos}
<!-- competir.formato.*, competir.campo.*; engine/league.js LG_FMT_DEFAULT, LG_FMT_FIELDS, LG_MAX_FIGHTERS, LG_KOTH_CAP, lgSwissRounds; README «Torneos (E10, E11 y E12)» -->

| Format | How it is played | Options |
|---|---|---|
| **Single match** | Everyone in the same world, up to 20. If there are more, the first 20 play. It is the usual F1 contest. | — |
| **King of the hill** | The winner stays and meets the next challengers. | **Fighters per fight** (2 to 20), **The season ends**, **Champion retires after** (5 wins in a row by default), **No repeated challengers** |
| **Round robin** | Everyone against everyone else, using the circle method. | **Legs**: 1, or 2 with the seeding order swapped |
| **Step ladder** | They enter one at a time, in joining order. The first takes rung 1; each newcomer challenges from the top down and, if it wins, takes that rung. | — |
| **World cup** | Groups of 4 play a round robin; the top 2 of each group go to a knockout bracket (1A–2B, 1B–2A…). 8, 16 or 32 bots. | **Group stage legs**, **Pots** (**by Elo** or **random**), **Third-place match** |
| **Swiss** | Rounds of duels between bots with the same score, never the same opponent twice. Meant for 16 to 32 bots. | **Rounds (0 = auto)** |

Some details of each one:

- **King of the hill.** The first to win the number of wins in a row you asked for
  _retires undefeated_ and takes the season. If nobody manages it, the season ends
  at 3 × N fights and the one with the best Elo wins. With **The season ends:
  never (endless hill)**, each retirement adds a 👑 and the hill opens up again.
  Whoever collects the most crowns leads. With retirement at 0, the champion stays
  until it loses.
- **World cup.** **Pots by Elo** uses the tournament's all-time Elo (1500 for
  those with no history): one bot from each pot per group. The groups are drawn
  when the first match is launched, or earlier with **Draw the groups** in
  Entrants. Tiebreakers in the groups: head to head, group Elo, fewer rounds won at
  the cap, fewer cycles and the draw order.
- **Swiss.** In auto mode, ⌈log2 N⌉ + 1 rounds are played: 4 with 8 bots, 5 with
  16 and 6 with 17 to 32. A win is 1 point. With an odd number of bots, the lowest
  one that hasn't had it yet gets a _bye_, worth 1 point. Tiebreakers: Buchholz
  (the sum of the opponents' points), Elo and rounds won by extinction. Bots that
  join after the season has started play from the next one.

No format has draws: a void match is played again.

## The match rules {#reglas}
<!-- lib/competir/Reglas.svelte, EditorPartido.svelte; competir.reglas.*, competir.campo.*; LG_FMT_DEFAULT; partido-f1.json; PLAN.md decisión 21 -->

The rules have two parts.

**World**: the world's parameters, without species.

- **F1 base**: the F1 league settings. Costs, physics and a toroidal 9237 × 6928
  field.
- **No costs**: the F1 base with every cost at 0. Bots spend no energy.
- **From Experiment**: the options and objects of a scenario (built-in, your own
  or the **Experiment draft**), without its species. See [[app/escenarios]].

**Match values**:

| Value | Default | What it does |
|---|---|---|
| **Bots per species** | 5 | How many bots of each entrant are seeded in each round. Each entrant can have its own number. |
| **Starting energy** | 3000 | The energy of each bot when the round starts. |
| **Minimum rounds** | 5 | The _N_ of the √N + N/2 rule. |
| **Wins to take the match (0 = off)** | 3 | The first species to reach it takes the match. Useful with 3 species or more. |
| **Cycle cap per round (0 = off)** | 5000 | The longest a round can last. |
| **At the cap, the round goes to** | the species with the most bots | Or **the species with the most energy** (nrg + body × 10). |
| **Max bots per species (0 = off)** | 500 | If a species goes over it, its poorest bots are removed. It keeps one that reproduces nonstop from slowing the match down. |

In the tournament's **Rules** tab, **See the changes** lists how the world differs
from its base. **Open in Experiment** opens it as a draft, to look at it or
retouch it; the tournament doesn't change.

:::cuidado
Format, values and rules **stay fixed from the first match** of the season (you'll
see a 🔒). While the season has no matches, **Change format and rules** lets you
edit them. To change them afterwards, start a new season.
:::

The world's parameters are explained one by one in [[app/experimentar-avanzado]].
The ones for the F1 contest from the manual ([[param:opt:91]], [[param:opt:97]],
[[param:opt:98]], [[param:opt:99]], [[param:opt:100]]) are set by the tournament in
every match; you don't need to touch them.

## Entrants {#participantes}
<!-- lib/competir/Participantes.svelte; competir.participantes.* -->

The **Entrants** tab shows each bot with its **Color**, its **Origin** (from the
forum, own, hybrid or built-in), its number of **Bots** and the fingerprint of its
frozen DNA. There you can also:

- enter more with **Add from the Library**;
- change the color or the number of one (empty = the format's);
- remove one with **Remove**, if it hasn't played yet in this season;
- change the **Entrants** mode and, in the modes with a draw, the pool and **How
  many**; **Draw** replaces the list with a new draw.

Once the season has started, the draw is locked until the next season.

## Play {#jugar}
<!-- lib/competir/PanelJuego.svelte; juego.js vigiaPartido; competir.jugar.*; PLAN.md decisión 23 -->

The **Play** column says how much of the season is left and who fights next. There
are two ways to move forward.

**▶ Play** launches the next match in the app's simulation and takes you to
Observe, with a break screen before each fight (5 seconds by default, adjustable
from 0 to 60). Below it, **When the fight ends** chooses how far it goes:

| Option | What it does |
|---|---|
| **stop** | Plays one fight and stops. |
| **go on until the end of the season** | Goes on with the remaining fights and stops after announcing the champion. It's the default. |
| **go on with new editions** | When the season ends, it starts another one and goes on, in a loop. The new edition follows the entrants mode: a **Fixed list** carries over whole; with a draw, it is drawn again. |

Every fight is recorded in the tournament. The choice is remembered in this
browser and can be changed while playing, from the caption in Observe (see
[[app/observar#tv]]). **Stop when the fight ends** and **Abandon the fight** are
there too. The tournament goes on even if you go to another section: a strip
below the top bar shows it on every screen (see [[app/observar#franja]]).

**▶ Play** plays the open season with the entrants it has, even if it hasn't
started yet: it doesn't draw them again. The new editions of **go on with new
editions** do the same as **New season**: a fixed list carries over whole and
the modes with a draw take entrants from the pool. To watch it like on TV, Observe
has [[app/observar#pantalla|full screen]].

While a match is in play, this column shows the score with the round, the cycle (with a thin bar if the format has a cycle cap),
the **Bots alive** and the **Rounds won** of each one. **Watch in Observe** takes
you to watch it, and **Abandon** cuts it without recording it. In the other
sections, a floating scoreboard shows the same; you can collapse it, or go back
with **Go to Compete** (on a phone it starts collapsed and, with a tournament
in progress, gives way to the [[app/observar#franja|strip]]). With a tournament in progress, **Abandon** asks for
confirmation and also stops the tournament, like **Abandon the fight** in the
strip.

:::cuidado
The match takes over the Observe simulation and replaces whatever was there. While
it is being played, don't seed, don't edit objects and don't change parameters: if
the simulation receives a live change, the match is abandoned and not recorded.
:::

**Background round** plays at once all the matches the format lets you play
without waiting for other results. For example, the whole pending schedule of a
round robin or the current round of the Swiss. The matches run without drawing, at
top speed and on several workers at once. Since each match uses its own seed, the
result is the same as watching them. It notifies you when it finishes. While it
runs, the season is locked. **Cancel the round** stops it. The quick match doesn't
play background rounds.

### With a tournament in progress {#en-curso}
<!-- PLAN-TORNEO-EN-CURSO.md TC4 (T8, T10); tv.svelte.js hayTorneoEnCurso, torneoEnCurso; torneos.svelte.js enCursoBloquea, abrir, inscribirSinAbrir; Competir.svelte congelado; Inicio, Experimentar, DialogoLote, Inspector (consola.js MODIFICAN), DisenadorOjos; i18n competir.enCurso.*, observar.tv.enCurso.* -->

While a tournament plays, the app's simulation is its fight and the open
tournament is that one. So, until you stop it (from the strip or with
**Abandon**):

- **The tournament is read-only**: entrants, rules, draws, the name, the new
  season, ↻ and **Replay and analyze**, **Clear** and **Delete**. A notice at
  the top explains it, with **Tournament controls**.
- **No other tournament opens**: the others show in the list, dimmed, but don't
  open, because opening another would cut off the one being played. You can't
  create one with **New tournament** or import a .json either (both open the
  new one).
- **Nothing else is played**: you can't ask for a **Background round** of this
  tournament. A round of another tournament requested earlier keeps running.
- **In [[app/inicio]] and [[app/experimentar]]**, what would replace the
  simulation (starting a scenario, resuming a run, opening a file, **New
  simulation**, **Apply to current**) is off, with the notice “A
  tournament is in progress: stop it to use the simulation” and **Tournament
  controls**. In [[app/bots]] the same goes for **Seed into the current run**.
- **In the [[app/inspector]]** the Player Bot doesn't show up, the eye
  designer only reads the eyes and builds the gene, and the console doesn't
  send the commands that change the fight (`set`, `energy`, `cycle`,
  `execrob`, `play` and `pause`).
- **[[app/bots]] and [[app/analizar]] stay free.** **Enter in a tournament**
  doesn't offer the tournament in progress, and enters the bot in the others
  without opening them.

<!-- engine/torneos.js lgEdition (con {sortear: false} desde tv.svelte.js; temporada terminada: lgNewSeason draw); tv/maquina.js PAUSA_DEF 5, PAUSA_MAX 60 -->

## Standings, structure and matches {#tabla}
<!-- lib/competir/Tabla.svelte, Estructura.svelte, Partidos.svelte; vistas.js vistaEstructura; engine/league.js lgElo (K = 32 / (N − 1)), LG_ELO0, LG_H2H_MAX 14 -->

The tournament's tabs are **Standings**, the format's view, **Matches**,
**Entrants**, **Rules** and **Seasons**.

**Standings**: position, matches played (**P**), won (**W**), lost (**L**),
percentage, **By cap** (the share of the rounds won that were decided by the cycle
cap), **Avg. cycles**, **Elo** and the **Last** results. The Swiss adds **Pts**
and **Buchholz**, and the endless hill, the 👑. Below, the format's tiebreak order
and, with up to 14 entrants, the **Head to head** table.

The **Elo** starts at 1500. In a fight of N, the winner beats each of the others
with K = 32 / (N − 1). That way a fight with many entrants isn't worth more than a
duel.

The **format's view** changes its name:

| Format | Tab | What it shows |
|---|---|---|
| Swiss | **Rounds** | Each round with its pairings and the bye |
| World cup | **Groups and bracket** | The pots, the group tables and the bracket |
| King of the hill | **Fights and crowns** | The king, its streak and the crowns |
| Step ladder | **Ladder** | The rungs and who is challenging |
| Round robin | **Fixtures** | The matchdays |

**Matches** lists each match with its winner, cycles, rounds by cap and **Seed**.
Two actions:

- **↻ Replay** plays the match again with the same rules, entrants, seeding order
  and seed, and warns you if the result doesn't match.
- **Replay and analyze** runs it again as a run and opens it in [[app/analizar]].
  It isn't recorded.

The seed is what makes a match repeatable: see [[tecnico/semillas]].

## Seasons {#temporadas}
<!-- lib/competir/Temporadas.svelte; competir.temporadas.*, competir.temporada.* -->

When the season ends, **Play** shows the champion and a button to **Start season
N**, which asks for confirmation. If the tournament draws entrants, it says “(new
draw)”. The **Seasons** tab has the same thing with **New season**, the list of
seasons (with **See** to open a past one) and the **All-time table of the
tournament**: seasons played, seasons won, P, W and an Elo that carries over from
one season to the next.

A new season unlocks format, values and rules. The entrants carry over unchanged
or are drawn again, depending on the mode.

## Hall of Fame {#salon}
<!-- lib/competir/Salon.svelte; competir.salon.* -->

The **Hall of Fame** gathers all the saved tournaments. There is one row per DNA:
the same bot under another name in another tournament is the same row. It shows
seasons won (🏆), tournaments, seasons played, P, W, percentage and a single Elo
calculated over all the matches, in date order. **Refresh** recalculates it.

## Report, export and import {#archivos}
<!-- competir.informe.*, competir.lista.* (competir.lista.archivos: clásica versión 1 y 2); README «Compartir»; lib/competir/migracion.svelte.js (al arrancar la app, src/main.js, una sola vez; aviso en Competir) -->

- **Tournament report** generates an `.html` report of the last season:
  standings, format structure, Elo and matches with their seeds. It is also kept in
  Analyze → Reports (see [[app/informes]]).
- **Export** downloads the open tournament as a `.json`, with its rules, its
  entrants with their DNA and its matches.
- **Import .json** loads it as a new tournament. It also accepts the tournament and
  league files from the [[app/clasica|classic interface]].

The first time you open the new app, it copies the tournaments from the classic
interface in this browser, and Compete tells you what it brought. Where everything
is stored and how to back it up is in [[app/tus-datos]].

For ideas on how to build a bot that wins tournaments, see
[[estrategias/torneos]].
