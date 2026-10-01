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

### Perfilar muchos bots: sistema suizo

El rey de la colina encuentra un campeón, pero no ordena al resto: si un bot
domina, cada retador pelea una sola vez y siempre contra él. Para ordenar
todo el Bestiary conviene el suizo:

```sh
node tools/fight/torneo.mjs swiss --popcap 100 --seed 1
```

Cada ronda empareja bots con el mismo puntaje sin repetir rival (de arriba
abajo, cada uno con el primer candidato que no enfrentó; si lo que queda no
se puede emparejar, prueba el siguiente, y solo si no hay forma acepta una
revancha); con
⌈log2 N⌉ + 1 rondas (11 para ~540 bots) los fuertes terminan peleando entre
ellos. Las peleas de una ronda son independientes y corren en paralelo
(`--jobs`, por defecto núcleos − 2). Puntos: victoria 1, nula ½, bye 1.
La tabla (`standings` del JSON, que se guarda tras cada ronda) ordena por
puntos, Buchholz (suma de los puntos de los rivales), Elo y rondas ganadas
por extinción. Las semillas se fijan en el orden del emparejamiento: con
`--seed` el torneo es reproducible aunque corra en paralelo.

La tabla y el emparejamiento son los del formato *Swiss system* de los
torneos de la web (`lgSwissTable` y `lgSwissPair` de `web/league.js`):
para el mismo orden inicial y los mismos resultados, los dos arman los
mismos cruces. `node tools/swiss/cruces_suizo.mjs <JSON>` lo comprueba
con una corrida (las corridas anteriores a la vuelta atrás, que aceptaban
revanchas evitables, se comparan hasta la primera revancha).

### Receta recomendada: castigar a los pasivos

Con las reglas F1 tal cual, estar vivo casi no cuesta (AGECOST 0,01 y
BODYUPKEEP 0,00001: unos 100 de energía por bot en 5000 ciclos) y el tope de
ciclos da la ronda al que tiene más bots. Un bot que solo se reproduce gana
sin matar: en el suizo del Bestiary con esas reglas, el 21,6 % de las rondas
se decidió por tope y Red queen llegó invicta al 9.º puesto con 11 de sus 15
rondas ganadas por tope.

Para perfilar agresividad:

```sh
node tools/fight/torneo.mjs swiss --cap 5000 --cap-mode nrg --cost 31=1 --popcap 100 --seed 1
```

- `--cap-mode nrg`: al tope gana la energía (nrg + body×10), no el número.
- `--cost 31=1` (AGECOST): 1 de energía por bot y por ciclo; sin cazar ni
  comer, un bot de 3000 muere en ~3000 ciclos.

Calibración (8 bots, 4 que ganaban por tope y 4 agresivos, 3 rondas):

| Variante | Rondas por tope | Pacifist | Red queen |
|---|---|---|---|
| F1 tal cual | 24 % | 2.º | 6.º |
| nrg + AGECOST 0,2 | 33 % | 4.º | 7.º |
| nrg + AGECOST 0,5 | 24 % | 4.º | 7.º |
| **nrg + AGECOST 1** | **8 %** | **7.º** | **8.º** |

Resultado con el Bestiary entero (2026-09-28: 538 bots, 11 rondas, 2959
peleas en 75 min con 8 en paralelo, ninguna nula): campeón Etch Mk II (F1),
11-0 con 33/33 rondas ganadas por extinción; los 30 primeros ganaron el 91 %
de sus rondas por extinción. Los que ganaban por número se hundieron (Red
queen #9 → #83, Pacifist v0.01 #65 → #247, Purple Flamma #41 → #301) y
subieron cazadores tapados (James 4I #58 → #6, This'n'That #60 → #7). La
familia Spinner (Moonfisher) pone 7 versiones entre los 26 primeros.

Otros costes de mantenimiento, por si se quiere afinar (`--cost i=v`):
BODYUPKEEP (30, × body), DNACYCCOST (24, × largo del ADN), AGECOSTSTART (32,
edad desde la que se cobra) y el coste por edad creciente: logarítmico
(`51=1`) o lineal (`60=1` con la pendiente en 33). Todos se multiplican por
CostX (54). Ver `Upkeep` en `core/include/dbcore/robots.hpp`.

Todas las opciones están en la cabecera de `torneo.mjs`: participantes
(`--bots`, `--limit`), formato (`--retire`, `--endless`, `--no-repeat`),
partido (`--qty`, `--nrg`, `--rounds`, `--wins`, `--cap`, `--cap-mode`,
`--popcap`), mundo (`--min-vegs`, `--repop-amount`, `--repop-cooldown`,
`--max-energy`, `--max-pop`, `--opt id=v`, `--cost i=v`, `--preset f1|panel`),
`--seed` (el torneo entero reproducible: cruces y semillas de cada partido),
`--match-seed` (en `duel`, la semilla del partido tal cual: reproduce un
partido de un JSON con el mismo orden de luchadores),
suizo (`--swiss-rounds`, `--jobs`), `--exe` y `--out`.

Cada `dbfight` arranca con prioridad baja (por debajo de lo normal): con
varias peleas en paralelo la máquina sigue usable. Si igual se pone lenta,
bajar `--jobs`.

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

### Diagnóstico de una pelea

Para ver por qué un bot pierde una ronda:

```sh
# la configuración del partido (con el alga copiada al lado)
DBFIGHT_CFG=/tmp/p.cfg node tools/fight/torneo.mjs duel A.txt B.txt --match-seed 31741
# cada 250 ciclos, por especie: bots, medias de nrg/body/shell/poison,
# envenenados y paralizados (por stderr; el partido no cambia)
DBFIGHT_TRACE=250 build/dbfight.exe /tmp/p.cfg
```

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
ciclos por ronda; 4,4 s de media en el Bestiary). El rey de la colina es
secuencial (cada pelea depende de la anterior). El suizo con 8 peleas en
paralelo hace ~1,7 peleas/s: una ronda de 269 peleas en ~3 min.

Si una pelea queda nula o `dbfight` falla, el rey de la colina descarta al
bot que el cargador rechazó (o a los retadores) para no repetirla siempre
(`dropped` en el JSON); el suizo la cuenta como nula (½ punto cada uno).
Las corridas largas guardan el JSON parcial (`done: false`).
