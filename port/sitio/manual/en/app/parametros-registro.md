---
titulo: "Parameters: Recording"
resumen: "The record of the dead, which keeps a record of every bot that dies, and the interval of the classic interface's charts."
etiquetas: [recording, dead, snapshot, charts, parameters]
estado: revisada
---
<!-- opciones.js «Registro»; core database.hpp (AddRecord, Snapshot, SnapshotFitness), robots.hpp KillRobot (DeadRobotSnp / SnpExcludeVegs); port/HISTORIA.md «Registro y análisis (etapa E6)»; web2/src/lib/observar/MenuInstantanea.svelte; i18n/es/observar.json observar.snp.* -->

This group controls what the simulation records for later analysis. The
important parameter is the record of the dead: one record for every bot that
dies, with its lineage, its mutation history and its DNA. It is the way to study
those that did _not_ survive, which in a long run is almost all of them.

You do not need to come here to use it: the **Snapshot** menu in Observe has the
same checkboxes and the buttons for downloading the record (see
[[app/observar]]).

## The record of the dead {#muertos}
<!-- MenuInstantanea.svelte: casillas 111/112 (aplicarCambioVivo; deshabilitadas con stats.f1), cuenta «Registros acumulados», Descargar (deadTake sin vaciar), Reiniciar (confirmación); veterano.js ARCHIVOS_MUERTOS -->

With [[param:opt:111]] on, every time a bot dies the engine saves its record.
The records pile up in the simulation until you download them:

1. In Observe, open the **Snapshot** menu.
2. Turn on **Record dead bots** (and, if you want, **Without vegetables**). The
   change is applied right away and noted in the run.
3. Let the simulation run. The menu shows how many records it holds under
   **Accumulated records**.
4. Click **Download**: two files are downloaded, `DeadRobots.snp` with the records
   and `DeadRobots_Mutations.txt` with each bot's mutation history. Downloading
   deletes nothing: the record keeps adding up.
5. To start from zero, **Reset** deletes what has accumulated (it asks for
   confirmation).

While an F1 contest is running ([[app/parametros-modos]]), the menu's two
checkboxes are disabled.

Each record has the same format as the **Snapshot of the living (.snp)** in the
same menu, so you can compare the living with the dead using the same tools:

| Field | What it is |
|---|---|
| Number and parent | The bot's unique number and its parent's: they are used to build the family tree. |
| Species | The name of the founding species. |
| Generation and birth | How many generations separate it from the founder and in which cycle it was born. |
| Age | The cycles it lived. |
| Mutations | The total accumulated by its lineage and how many are its own. |
| DNA length | Instructions in its genome (see [[.dnalen]]). |
| Children and victims | How many children it had and how many bots it killed. |
| Fitness | The score that **Find the best** uses to pick the fittest ([[param:opt:96]]), computed at the moment of death. |
| Energy | Energy plus 10 per point of body, at death. |
| Chloroplasts | The ones it had. |
| DNA | The complete genome, as text. |

A bot with empty DNA leaves no record. To understand the mutation and lineage
columns, see [[simulacion/mutaciones]] and [[simulacion/especies]].

:::parametro opt:110
<!-- README E6: el worker de la clásica alimenta cada chartingInterval ciclos solo los gráficos abiertos; la nota de opciones.js dice que la app nueva no lo usa -->
How many cycles pass between points on the classic interface's charts (see
[[app/clasica]]): with 200, the population curve has a point every 200 cycles. A
small value gives more detailed curves, which fill up sooner. The new app does
not use it, because its charts sample on their own (see [[app/analizar]]), but
the value is saved with the simulation, also in the `.dbsim` file.
:::

:::parametro opt:111
<!-- robots.hpp KillRobot: if DeadRobotSnp && !(Veg && SnpExcludeVegs) AddRecord; database.hpp: DnaLen == 1 → sin registro -->
Turns on the record of the dead: from then on, every bot that dies leaves a
record, whatever the cause (hunger, old age, a shot, a disqualification). Those
that died before it was turned on do not appear. Turning it off stops recording
but does not delete what has accumulated. In a simulation with a large
population the record grows fast: every record carries the whole DNA.
:::

:::parametro opt:112
<!-- robots.hpp KillRobot: Veg && SnpExcludeVegs → sin AddRecord -->
With the record of the dead on, it leaves vegetables out. It is almost always a
good idea: in a world with repopulation, vegetables are born and die by the
thousands and would bury the animals you want to study. It only affects the
record of the dead; the snapshot of the living includes everyone.
:::
