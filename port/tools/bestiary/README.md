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
en ejecución se marca "dispara (valor calculado)" en vez de adivinarlo.

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
