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
```

El paso 2 necesita `port/build-wasm/dbcore.js` compilado (preset `wasm`).

## Decisiones

- El crawler solo toma los bloques `[code]` de la **primera página** de cada
  tema (los adjuntos del foro no son visibles para invitados; con cuenta se
  podría ampliar). Normaliza `&nbsp;`/zero-width, que rompen el tokenizador.
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

Corrida del 2026-08-26: 607 candidatos extraídos, 607 válidos,
545 publicados (uno por tema).
