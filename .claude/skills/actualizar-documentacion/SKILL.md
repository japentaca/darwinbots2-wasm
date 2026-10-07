---
name: actualizar-documentacion
description: Lleva un cambio de código a la web y a los manuales en español e inglés (manual, textos de la app, portadas, READMEs y planes). Usala después de cualquier cambio de comportamiento, interfaz, parámetros, textos o cifras del proyecto, antes de commitear.
---

# Actualizar la documentación tras un cambio

El sitio darwinbots-wasm.org (portada + manual + app) se publica en cada push
a `main`. Si el código cambia y el manual no, el sitio miente. Esta skill
recorre todo lo que puede quedar desactualizado, **siempre en los dos
idiomas**.

## 1. Qué cambió

Mirá el diff (`git diff`, `git diff --cached` o los commits de la tarea) y
anotá en una lista corta: comportamiento de la sim, pantallas/rótulos de la
app, parámetros, formato de archivos, cifras (casos, aserciones, bots),
herramientas.

## 2. Dónde buscar según qué tocaste

| Tocaste | Revisá |
|---|---|
| `port/core/`, `port/wasm/` (comportamiento) | `manual/*/simulacion/`, `manual/*/adn/`, fichas `manual/es/spec/*.yaml` y `manual/en/spec/*.yaml`, prosa de `sysvars/` y `operadores/`, `tecnico/diferencias.md`, `port/README.md` (bugs corregidos, API) |
| `port/web2/src/` (pantallas) | `manual/*/app/<sección>.md`, tutoriales y `empezar/` que nombran botones o rótulos, `src/i18n/es/*.json` y `src/i18n/en/*.json` |
| `port/web2/engine/opciones.js` | `es`/`en` y `ayuda.es`/`ayuda.en` de la opción; `:::parametro <clave>` en `manual/*/app/parametros-<grupo>.md` (el build falla si falta) |
| Una sección o pantalla nueva | Página `app/<sección>.md` en `port/sitio/indice.mjs` (con su título `en`), `node port/sitio/generar.mjs --sembrar`, y escribirla en los dos idiomas; el «?» de la barra enlaza a `app/<sección>/` |
| Formatos de archivo | `tecnico/formatos.md` |
| Bestiario, suite de tests | Cifras en `README.md`, `README.en.md`, portadas, `tecnico/creditos.md`, `.github/workflows/ci.yml` (comentario) |
| Algo que anuncia la portada | `port/sitio/publico/index.html` y `publico/en/index.html` |
| Una decisión o etapa | `port/web2/PLAN.md`, `PLAN-SITIO.md` o `PLAN-TORNEO-EN-CURSO.md` (no `spec/PLAN-EXTENSIONES.md` ni `spec/PROGRESO.md` para añadidos fuera de etapa) |

Para encontrar menciones, buscá en los dos idiomas el nombre del rótulo, la
clave i18n, la sysvar o el término:

```sh
grep -rn "<término>" port/sitio/manual/es port/sitio/manual/en port/sitio/publico README.md README.en.md port/README.md
```

## 3. Escribir

- **Primero el español**, después el inglés traducido de esa versión. Las
  reglas de formato (frontmatter, `[[enlaces]]`, bloques `adn`, anclas) están
  en la skill `escribir-manual`.
- La paridad la exige el build: mismo número de bloques ```` ```adn ````,
  mismos `:::parametro`, anclas `{#…}` iguales en los dos idiomas.
- i18n de la app: la misma clave en `es` y en `en`. Sysvars, operadores y
  nombres de bots no se traducen.
- Rótulos citados en el manual: tal como los muestra la app en ese idioma
  (en español «Hacé clic en …»).
- Una página editada que estaba `revisada` sigue `revisada` solo si
  verificaste lo que escribiste contra el código o la spec (dejá la cita en un
  comentario `<!-- 20-VM §5.4 -->` o `<!-- engine/opciones.js -->`). Si no,
  bajala a `borrador`.
- Un ejemplo de ADN que afirma «hace X» se comprueba con
  `node port/sitio/probar-adn.mjs`.

## 4. Comprobar

```sh
node port/sitio/generar.mjs --lint      # desde la raíz; necesita port/build-wasm
cd port/web2 && npm test && npm run check
```

Si cambió algo visible, mirá la página en el navegador (`npm run dev` en
`port/web2` sirve `/manual/` y `/en/manual/` desde `port/sitio/salida/`).

## 5. Informar

Al cerrar, listá qué documentos actualizaste en cada idioma. Si el cambio no
tenía nada que documentar, decilo («sin impacto en el manual») con el motivo.
