---
name: escribir-manual
description: Formato y reglas para escribir, corregir o traducir páginas del manual de darwinbots-wasm.org (port/sitio/manual/es y en), incluidas las fichas de sysvars y operadores y la prosa de parámetros. Usala al editar cualquier .md o .yaml del manual.
---

# Escribir una página del manual

Referencia completa: `port/web2/PLAN-SITIO.md` («Cómo se escribe una
página», «Fichas en castellano llano», «Cómo se traduce una página»). Lo
esencial:

## Dónde

- Una página = `port/sitio/manual/<es|en>/<capítulo>/<página>.md`, mismos
  slugs en los dos idiomas.
- El orden y los títulos del índice están en `port/sitio/indice.mjs` (con el
  campo `en`). Una página nueva se agrega ahí y se siembra con
  `node port/sitio/generar.mjs --sembrar` (crea el `.md` en los dos idiomas).
- Las fichas de sysvars/operadores salen de `manual/es/spec/*.yaml`
  (castellano llano, lo que hace el port) y de `manual/en/spec/*.yaml`.
- Fuentes de verdad: `spec/` manda, `port/core/` desempata, y para la app
  `port/web2/engine/opciones.js` y las pantallas. No se usa el wiki.

## Formato

```
---
titulo: Genes: cond, start, else y stop
resumen: "Una frase: sale bajo el título, en el índice y en el buscador."
etiquetas: [gen, cond, start]
estado: borrador
---
```

- `estado`: `pendiente` → `borrador` → `revisada` (verificada contra la spec
  o el código, con citas en comentarios `<!-- 10-CICLO §4 -->`, que no se
  publican).
- Cursiva con `_guiones bajos_` (el asterisco es del ADN: `*.eye5`).
- Enlaces: `[[.shoot]]`, `[[.7]]`, `[[op:store]]`, `[[param:opt:11]]`,
  `[[adn/genes]]`, `[[adn/genes#ancla]]`, `[[adn/genes|otro texto]]`. Un
  destino o ancla inexistente hace fallar el build.
- `## Título {#ancla}` fija el ancla; si no, sale del texto sin acentos.
- ```` ```adn ```` pasa por el lint del wasm; ```` ```adn sin-lint ```` solo
  para mostrar un error a propósito.
- Avisos: `:::nota` / `:::cuidado` … `:::`. Prosa de un parámetro:
  `:::parametro opt:11` … `:::`.
- Fases del ciclo, siempre con estos nombres: el ADN → se borran los sentidos
  → los disparos → fuerzas y choques → movimiento → acciones → nacimientos y
  muertes → el sol.

## Estilo

- Español rioplatense, llano, para alguien que no leyó el fuente VB6.
  «Hacé clic en», «anclado» (bot con `.fixpos`), «10 %» con espacio.
- Inglés: «anchored», «Vegetable», «10%» sin espacio; rótulos tal como los
  muestra la app en inglés.
- Sysvars, operadores y nombres de bots nunca se traducen.

## Traducir

Desde el original en español ya corregido. Bloques `adn` copiados tal cual
(se pueden traducir los comentarios `'`), `[[…]]` sin cambios, mismas anclas
`{#…}`. La paridad del build solo compara bloques y parámetros: si el
original cambia, la traducción se revisa a mano.

## Comprobar ejemplos

```sh
node port/sitio/probar-adn.mjs bot.txt --ciclos 50 --mem up,nrg --vegs 10
node port/sitio/probar-adn.mjs --adn "cond start 10 .up store stop" --ciclos 5
```

(Todas las opciones, como `--otro`, `--set`, `--opt` o `--cost`, están en la cabecera del script.)

Al final, `node port/sitio/generar.mjs --lint` desde la raíz debe salir sin
errores y con 0 pendientes en ambos idiomas.
