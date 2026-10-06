---
name: verificar-cambios
description: Corre las mismas comprobaciones que CI y el despliegue del sitio (suite C++ nativa y wasm, tests y Biome de la app, build de Vite, generador del manual con lint y paridad, fuentes VB6 intactos). Usala antes de dar una tarea por terminada o de commitear.
---

# Verificar antes de cerrar

Corré lo que corresponda a lo que tocaste; ante la duda, todo. Informá los
resultados tal cual (cifras, fallos con su salida); no digas «pasa» sin
haberlo corrido.

## Siempre

```sh
git diff --exit-code 02b20d7 -- Darwinbots2/   # debe salir vacío
git diff --stat                                # tamaño razonable (finales de línea)
```

## Motor (`port/core/`, `port/wasm/`, `port/tests/`)

Desde `port/` (con `EMSDK` definido para wasm):

```sh
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
node tests/wasm/solo_lectura.mjs
```

Los tres modos deben dar el mismo verde. Si cambia el número de casos o
aserciones, actualizá las cifras (ver skill `actualizar-documentacion`).

## App (`port/web2/`)

```sh
npm test            # con port/build-wasm compilado corren también los que usan el wasm
npm run check       # Biome sobre web2 y port/sitio
npx vite build
```

Los smokes de `test/smokes/*.mjs` (liga, torneos, copa, suizo…) se corren
con `node test/smokes/<nombre>.mjs` si tocaste `engine/`.

## Manual y sitio

Desde la raíz:

```sh
node port/sitio/generar.mjs --lint
```

Falla con enlaces o anclas rotas, referencia incompleta, paridad es/en rota
o un bloque `adn` con avisos. Debe informar 0 pendientes en `es` y en `en`.

Para probar el armado completo como en el despliegue:

```sh
sh port/web2/scripts/armar-sitio.sh <carpeta-temporal> local
```

## Cambios visibles

Si cambió algo que se ve (app o manual), miralo en el navegador:
`npm run dev` en `port/web2` (sirve `/app`, `/classic`, `/build-wasm`,
`/manual/` y `/en/manual/`), en los dos idiomas.
