# Archivador del Bestiary del foro

Baja los bots publicados en el Bestiary del foro oficial
(http://forum.darwinbots.com, board 13 y sus 12 sub-boards: F1/F2/F3,
Short, Multi-Bots, Veggies, Interesting behaviour, EcoSim, Mutations,
The Starting Gate, Single store, Untagged), los valida con el core real
y publica los buenos en `port/web/bots/` para el selector de la página.

Capa host pura: no toca `port/core/` ni el contrato de fidelidad.

## Uso (desde este directorio)

```
python crawl_bestiary.py            # 1. rastrea el foro → bots_raw/ (~20-40 min)
node validate_bots.js bots_raw validated.json   # 2. valida con dbcore.wasm
python publish_bots.py              # 3. publica → ../../web/bots/ + bots.json
node analyze_bots.js                # 4. perfil genético → ../../web/bots/profiles.json + genes.json
```

Los pasos 2 y 4 necesitan `port/build-wasm/dbcore.js` compilado (preset `wasm`).

## Decisiones

- El crawler anónimo solo toma los bloques `[code]` de la **primera página**
  de cada tema (los adjuntos del foro no son visibles para invitados).
  Normaliza `&nbsp;`/zero-width, que rompen el tokenizador.
- Los **adjuntos `.txt`** se cosechan aparte con la sesión del usuario en el
  navegador (fetch dentro de una página del foro logueada, con pausas de
  cortesía) y se fusionan en `bots_raw/` con `merge_atts.py` a partir del
  volcado `bots_att_*.json`; `publish_bots.py` los prefiere sobre los
  bloques de código del mismo tema.
- Validación con el core, no con heurísticas: alta de especie + siembra del
  fundador (`db_sim_seed_species`), al menos un gen cerrado en el
  `db_sim_bot_text` resultante, y 50 ticks sin reventar.
- `publish_bots.py` elige **un bot por tema**: el adjunto válido si lo
  hubiera, si no el bloque de código válido más largo (suele ser la versión
  completa del bot frente a los recortes citados en las respuestas).
- Los bots del sub-board Veggies se marcan `veg: true` en `bots.json`; la
  página los siembra como vegetales.
- **Bots de la casa** (`house/`): bots escritos para este port, que no
  vienen del foro. `house/house.json` tiene su registro con el formato de
  `bots.json` (board `House bots`, `url` vacía) y `publish_bots.py` los
  copia al final de cada publicación. Para agregar uno: su `.txt` en
  `house/`, su registro en `house.json`, copiarlo a `web/bots/` + su
  registro en `web/bots/bots.json`, y correr `analyze_bots.js`.
  - *Ringo Bonavena v3*: luchador F1 para los torneos (ojos en abanico,
    golpe al cuerpo, shell y poison, división con sobra), ajustado con la receta anti-pasivos de `tools/fight/README.md` (tope
    5000 por energía, AGECOST 1, 100 bots por especie). Diagnóstico con
    los partidos que v2 perdía en el suizo: moría con mucha energía, no
    por desgaste. Cambios:
    - pariente por los conteos del ADN del que mira (`.refeye`,
      `.refshoot`, `.refup`, `.refaimdx`, `.refdx`) y no por `.out1`:
      Rabidus copia `in1` en `out1` y Ringo no le tiraba;
    - lazos ajenos cortados cada ciclo (`*.tiepres .deltie store`) y sin
      tirar mientras está atado: lo que un lazo escribe (el torpedo de
      Spinner pone `.shootval` 31999) llega después del ADN y antes del
      tiro, y ese `-6` le costaba toda la energía;
    - slime 500 contra virus (Rabidus: `.vshoot` enorme; DIN2: `.repro`
      que sube solo) y un gen de limpieza al final del ADN;
    - poison mínimo 300, ojo central ancho, acercamiento por distancia y
      tiro barato (`-1` con shootval 0) contra rivales de poca energía y
      poco poison; paralizado, shootval 1 (el `-2` forzado casi no regala);
    - disfraces: `.out7` de This'n'That, `.out8`/`.out9` de la familia
      BETA y un gen muerto con los conteos de `.aimdx` de Republican Wasp
      y de ojos y `.shoot` de Multiply4: lo toman por uno de los suyos.

    Banco de 17 rivales (los 5 que le ganaban a v2, v1, v2 y 10 del top
    30), 6 semillas por cruce: v1 35-61, v2 30-66, v3 100-2. Suizo del
    Bestiary con la receta anti-pasivos (2026-09-28, 539 bots, `--seed
    1`): v3 campeón 11-0 (33-4 en rondas, 22 por extinción), v1 #28, v2
    #86 (antes #148). No cruzó a This'n'That ni a BETA-AA (#2 y #3),
    a los que en el banco solo les gana por disfraz: si cambian su
    reconocimiento de parientes, el disfraz deja de servir.

    Revisión del 2026-09-29 (mismo archivo; el suizo de arriba es de la
    versión anterior). En la página perdía con Astronomo (Commander
    Keen) y a veces daba vueltas alrededor de un punto vacío:
    - Astronomo 2 lo mataba en ~100 ciclos por ronda: su tiro de memoria
      pone `.shootval` 30000 después del ADN, y el `-6` de Ringo costaba
      toda la energía (lo mismo que el lazo de Spinner). Contraatacar
      con tiros de memoria no alcanzó (el 2.1 le escribe `.shoot` -2 y
      cualquier shootval grande propio lo vaciaba); quedó el disfraz:
      `.out5` 1991 y los conteos de ADN de Astronomo (up 2, dn 3, sx 1,
      dx 2, aimdx 5, shoot 3, 22 ojos), ajustados con el gen muerto y con
      `0 add` antes de un `store`, que saca ese `.up`/`.shoot` del conteo
      (solo cuenta un número pegado al `store`). Ringo lo distingue de los
      suyos por `.reftie` (el pariente suma también `.refdn`/`.refsx`).
    - Se pierde el disfraz de Multiply4 (20 ojos, 6 tiros), incompatible
      con el de Astronomo. Con poison 300 Multiply4 le chupaba la energía
      a `-1`; con un mínimo de 800 los tiros rebotan envenenados y le
      gana 12-0 (un tiro de memoria con `.shootval` -3000 lo empeoraba).
    - Sin nada a la vista giraba 70 por ciclo acelerando a fondo: un
      círculo cerrado. Ahora va recto a velocidad 20 y cambia de rumbo al
      azar cada 100 ciclos (los ojos en abanico ya ven en redondo).
    - Con formas visibles, el ojo con foco que no es el frontal deja
      `.refxpos` en (0,0) u obsoleto (B-13) y Ringo perseguía y tiraba a
      ese punto: una forma (`.reftype` ≠ 0) ya no cuenta como rival.

    Banco anterior + los tres Astronomo (20 rivales × 6 semillas): antes
    108-12 (Astronomo 2 0-6, Astronomo 2-4), ahora 119-1 (18-0 contra
    los Astronomo; la única derrota, 5-1 contra v1).

    Revisión del 2026-10-01. En la página (torneo con 75 bots por
    especie) Gimmick 1.0 (F2) le ganó una pelea; en el banco le sacaba
    rondas en uno de cada tres partidos y uno de cada 15 partidos:
    - Gimmick tiene poison 500 con `.ploc` = `.shoot`. Contra un rival
      con más shell que poison Ringo cambiaba el golpe al cuerpo por un
      `-1`, que con shell ≈ poison (Gimmick: ~500 los dos) rebotaba
      envenenado: el poison le escribe 0 en `.shoot` cada ciclo, después
      del ADN y antes del tiro, y Ringo se quedaba sin tirar (6 a 11 de
      sus 13-16 bots envenenados a la vez). Ahora ese `-1` también pide
      poco poison en el rival (la vara del tiro barato).
    - Los `-6` de Gimmick (shootval 16) le comían el body y lo dejaban
      sin dividirse mientras Gimmick llenaba sus 75. Con shell body/2 en
      vez de body/3 los aguanta, pero siempre así se vuelve lento (la
      masa es body/1000 + shell/200) y Multiply4 le sacaba 38 rondas en
      60 partidos. Queda body/2 solo durante 500 ciclos después de ver un
      rival con shell > 400. Recordar los `-6` recibidos (`.shflav`) no
      sirve: los tiros cruzados de los propios Ringo también lo disparan.
    - Probado y descartado: dividirse con mucha energía y poco body (con
      `nrg > 6000`, 0-60 contra Gimmick: crías débiles; con 10000, peor
      que sin el cambio).

    Con 75 bots por especie, 60 semillas contra Gimmick 1.0: antes 56-4
    (171-33 en rondas), ahora 60-0 (180-3); Multiply4 sigue 60-0
    (180-0). Banco de 24 rivales (top 25 del suizo + los Astronomo) × 6
    semillas: 144-0 antes y después, en rondas 432-5 → 432-0. Con 500
    bots por especie (las reglas por defecto del torneo) el banco queda
    igual (125-19 → 123-21): ahí pierde con Republican Wasp y Etch Mk II
    0-6 y con This'n'That y Spinner v1.5, desde antes de esta revisión.

    Medición del 2026-10-02 (`torneo.mjs gauntlet`, 3 peleas a la vez),
    en 8 escenarios que cambian una cosa por vez sobre la receta
    anti-pasivos: F1 tal cual, sin tope de ciclos, 1 y 75 bots por
    especie, escasez y abundancia de algas, reglas del panel.
    - Contra el Bestiary entero (2 partidos por rival): 98,1 % (F1 tal
      cual) a 100 % en todos. Contra 38 rivales duros × 10: 100 % en la
      receta, sin tope, con 75 bots y con abundancia; 99 % con escasez;
      94 % con las reglas del panel (Gerbal3 2-8: el campo de 32000 lo
      hace tardar ~10000 ciclos y lo decide el tope); 93 % con 1 bot
      (Gimmick 1.0 y This'n'That 0-10); 70 % con F1 tal cual.
    - Suizo con el top 64 del Bestiary: 1.º con la receta y con 1 bot
      (dos semillas cada uno), 8.º y 7.º con F1 tal cual.
    - F1 tal cual: lo decide el tope de 500 bots por especie (con 100,
      Etch Mk II, Fruit Flies v0.2 y Republican Wasp pasan de 0-10 a
      10-0). Etch llega a 300-400 bots y cada uno le tira por ciclo un
      tiro de memoria (32000 en `.shootval`/`.strpoison`/`.strvenom`) y
      un lazo. El poison bloquea el tiro y el slime el lazo, pero cada
      bloqueo cuesta 18 de poison y 20 de slime, y el poison se repone
      a lo sumo 100 por ciclo (~5 bloqueos): rodeado, se desgasta y los
      tiros entran. Probado y descartado: dividirse antes (nrg 1500,
      body 700), slime 1500 y borrar `.tieloc`/`.tieval` cada ciclo
      (0-30 los tres). Queda así: Ringo es para la receta y para la
      página con 75 bots por especie; ganar con 500 pediría otro diseño
      (p. ej. huir del enjambre).

- **Bots extra** (`extra/`): bots del resto del foro (boards que no son
  el Bestiary: DNA - General, Newbie, Bot Tavern, Evolution Sims,
  Suggestions…, y las respuestas de los temas del Bestiary, que el
  crawler no mira) y del wiki (wiki.darwinbots.com). `extra/extra.json`
  tiene su registro con el formato de `bots.json`; `publish_bots.py` los
  copia antes que los de la casa. Corrida del 2026-10-02, con el foro y el
  wiki archivados enteros fuera del repo (temas por `action=printpage`,
  páginas por la API de MediaWiki):
  - 1455 bloques con pinta de ADN (`cond`/`start`, `store`, `stop`);
    1449 cargan en el core; 550 son ADN ya publicado;
  - de los 899 restantes se quitaron los fragmentos (menos de 2-3 genes)
    y las variantes de bots publicados (Jaccard de 4-gramas de tokens del
    ADN canónico ≥ 0,8, o ≥ 90 % contenido en uno publicado), y se
    agruparon las versiones casi iguales (Jaccard ≥ 0,6): 239 grupos, uno
    por grupo (el más largo);
  - curados a mano leyendo el tema: fuera los fragmentos, el código que el
    autor dice que no anda, las versiones intermedias de tutoriales y las
    pruebas de bugs. Entran 115: 45 «Forum bots», 40 Mutations (sobre
    todo bots evolucionados publicados en el foro: Coexistence 2022,
    Sexrepro experiment del wiki, Internet Mode), 15 Veggies, 6
    Interesting behaviour, 3 Multi-Bots, 3 «Wiki bots», 1 F1, 1 F2 y
    1 Short. Uno (Occura Amplificis) traía etiquetas `[color]` del foro
    dentro del ADN, quitadas a mano.
  Para agregar uno: su `.txt` en `extra/`, su registro en `extra.json`,
  copiarlo a `web/bots/` + su registro en `web/bots/bots.json` (antes de
  los de la casa) y correr `analyze_bots.js`.

`bots_raw/` y `validated.json` son productos intermedios (ignorados por git);
lo publicado en `port/web/bots/` sí se versiona.

Corrida del 2026-08-26: 607 candidatos de bloques de código + 146 adjuntos
cosechados con sesión (753 candidatos, 753 válidos), 588 publicados (uno
por tema).

## Perfil genético (analyze_bots.js)

`publish_bots.py` borra `web/bots/`, así que el paso 4 se corre siempre
después. Para cada bot publicado: alta + siembra del fundador y lectura de
`db_sim_bot_text`, que es el ADN **tal como lo entendió el core** (sysvars
con nombre canónico, sin comentarios, genes delimitados). Sobre eso, por
gen, una pila aproximada registra qué sysvars escribe (`store` y familia),
cuáles lee (`*.x`) y el valor literal de `.shoot` y `.tieloc`. Salida:
capacidades por bot y por gen, arquetipo, tamaño (S/M/L/XL por genes),
nº de tokens y un hash del ADN canónico (clave de los datos del usuario en
el Inventario de la página). Heurística, no fidelidad: un valor calculado
en ejecución se marca "shoots (computed value)" en vez de adivinarlo.

`genes.json` (solo lo carga el Laboratorio de híbridos) guarda por gen su
texto decompilado, la memoria propia que escribe (`w`) y lee (`r`) —las
direcciones 1..1000 que no son sysvar, p. ej. las de los `def`—, en qué
tokens aparece cada una como dirección literal (`ai`, para remapearla) y si
usa un número de gen literal en `.delgene`/`.mkvirus` (`gl`). Las
direcciones de sysvar salen de `core/include/dbcore/sysvars.hpp`, la misma
tabla del core. El script verifica la **ida y vuelta**: los genes pegados
de nuevo tienen que dar, en el core, el mismo ADN que el bot original
(corrida del 2026-09-25: 588 de 588 idénticos).

**Nombres únicos.** Varios temas comparten título (el mismo bot publicado
en varios sub-boards, dos versiones con el mismo título, adjuntos titulados
"1"). Al final, `analyze_bots.js` quita las copias con ADN idéntico (queda
la primera en el orden de `publish_bots.py`) y renombra las demás a partir
del ADN: el nombre de la cabecera del `.txt` si el título no tiene uno
("1" → "Saber", "Slam Funk 1.0"…) o, si lo tiene, el título más lo que
distingue a cada ADN (nº de genes, nombre de cabecera, arquetipo o
tokens). Corrida del 2026-09-26: 20 copias fuera, 568 bots, 0 nombres
repetidos.
