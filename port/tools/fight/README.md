# Peleas y torneos con el binario nativo

Correr partidos F1 (y un rey de la colina entero) sin navegador, con el core
compilado para la máquina. Dos piezas:

- **`dbfight.cpp`** → `build/dbfight.exe`: **una** pelea F1. Replica la capa
  host de la web (`contest.js` + `worker.js`: reinicio, alga de arranque,
  siembra, censo, rondas en un handle nuevo, tope de bots por especie y tope
  de ciclos) usando solo la API C de `wasm/dbcore_api.cpp`, incluida como en
  `tests/test_host.cpp`. El core no cambia.
- **`torneo.mjs`**: arma las reglas y el torneo y lanza un `dbfight` por
  pelea. Las reglas salen de la propia página (defaults del panel de
  `web/index.html` + el preset F1: `F1_OPTS`, `F1_COSTS`, `F1_KEYS`, campo
  9237×6928 toroidal) y los valores del partido de `LG_FMT_DEFAULT`; la
  lógica del rey de la colina es la de `web/league.js` (cargada en un vm).

## Compilar

```sh
cd port
cmake --preset native-gcc && cmake --build --preset native-gcc --target dbfight
```

`dbfight` se compila siempre con `-O2` (los presets no fijan el tipo de
build). Las salvaguardas numéricas del proyecto siguen (sin fast-math ni
FMA): los mismos duelos con `-O0` y `-O2` dan el mismo JSON, y unas 4-5
veces más rápido.

## Uso

```sh
# un duelo (por archivo o nombre del Bestiary, o ruta a un .txt)
node tools/fight/torneo.mjs duel 1.txt All_Hunter_F1_Spike43884_11-21-2014.txt

# rey de la colina con todo el Bestiary de combate, cada bot pelea hasta
# perder una vez y la temporada sigue hasta agotar los retadores
node tools/fight/torneo.mjs koth --no-repeat --endless --seed 1

# un grupo, otras reglas del partido y otra economía vegetal
node tools/fight/torneo.mjs koth --bots a.txt,b.txt,c.txt --retire 3 \
  --qty 10 --cap 8000 --cap-mode nrg --popcap 300 --min-vegs 20 --max-energy 60
```

Todas las opciones están en la cabecera de `torneo.mjs`: participantes
(`--bots`, `--limit`), formato (`--retire`, `--endless`, `--no-repeat`),
partido (`--qty`, `--nrg`, `--rounds`, `--wins`, `--cap`, `--cap-mode`,
`--popcap`), mundo (`--min-vegs`, `--repop-amount`, `--repop-cooldown`,
`--max-energy`, `--max-pop`, `--opt id=v`, `--cost i=v`, `--preset f1|panel`),
`--seed` (el torneo entero reproducible: cruces y semillas de cada partido),
`--exe` y `--out`.

Cada pelea deja una línea: `rounds AAB*` = rondas ganadas por el primero (A)
o el segundo (B); `*` = la decidió el tope de ciclos, sin `*` = el rival se
extinguió. El JSON (`tools/fight/out/`, fuera del repo) trae cada partido
con el resultado completo de `dbfight`, la tabla (`standings`, Elo), el
campeón y un resumen por bot: `fights`, `won`, `lost`, `void`, `roundsWon`,
`roundsWonExtinct` (rondas ganadas por extinción del rival) y `roundsLost`.

## dbfight solo

```sh
build/dbfight.exe pelea.cfg      # o "-" para leerla de stdin
```

La configuración es texto, un dato por línea y campos separados por TAB
(`seed`, `field`, `base`, `opt`, `cost`, `species`, `cap`, `popcap`,
`maxcycles`; ver la cabecera de `dbfight.cpp`). La primera especie es el
vegetal de arranque. Imprime una línea JSON: `winner`, `void` (motivo si no
hubo ganador), `seed`, `cycles`, `ticks`, `restarts`, `species` (victorias y
población final) y `rounds` (ganador, ciclos y `how`: `extinct` | `cap`).

## Fidelidad con la web

Con las mismas reglas, luchadores y semilla, `dbfight` da el mismo partido
que la página (el core es determinista entre nativo y wasm). Verificado el
2026-09-28 lanzando en la página, con `lgF1Rules()` y `contestLaunch`, dos
duelos del Bestiary (semillas 74059 y 92583): mismo ganador, mismas
victorias por especie, misma población final y mismos ciclos.

Diferencias de la herramienta, no del partido:

- **Ciclos**: `dbfight` suma todas las rondas. La web (`f1-over.cycles`)
  reporta solo la última: Countpop pone `TotRunCycle` en 0 al cerrar una
  ronda ganada (F1Mode.bas:435) y `worker.js` acumula ese 0.
- **Skin y colores**: cosméticos; `dbfight` usa un Timer fijo y una paleta
  fija. No cambian el resultado.

## Tiempos

Un partido de 5 rondas va de menos de 1 s a ~1 min (con el tope de 5000
ciclos por ronda). El rey de la colina es secuencial (cada pelea depende de
la anterior): con los ~550 bots de combate y `--no-repeat` son ~550
partidos, del orden de horas.
