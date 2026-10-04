#!/bin/sh
# Arma el sitio darwinbots-wasm.org (PLAN-SITIO.md S1; PLAN.md C1, C2 y C4):
#   <destino>/                 port/sitio/publico/ (portadas en español y en
#                              en/, _headers)
#   <destino>/manual/          el manual, generado por port/sitio/generar.mjs
#                              (con el lint de sus bloques adn: usa el wasm)
#   <destino>/en/manual/       el manual en inglés (el mismo generador)
#   <destino>/app/             port/web2/dist/ (la interfaz nueva)
#   <destino>/classic/         copia de port/web/ (la clásica, congelada)
#   <destino>/build-wasm/      dbcore.js + dbcore.wasm, compartidos por las dos
# y versiona los scripts de la clásica con ?v=<version> (cache busting). La
# nueva ya sale versionada del build de Vite (hash + DB_BUILD_ID).
#
# Uso: port/web2/scripts/armar-sitio.sh <destino> <version>
# Supone que ya existen port/web2/dist/ y port/build-wasm/dbcore.{js,wasm}.
# Si <destino> ya existe, se borra antes de armar (nunca "" ni "/").
# DB_DIST=<ruta> cambia la carpeta del build de la nueva (por defecto
# port/web2/dist); sirve para probar el armado sin correr Vite.
set -eu

if [ "$#" -ne 2 ]; then
  echo "uso: $0 <destino> <version>" >&2
  exit 2
fi
DEST=$1
V=$2

AQUI=$(cd "$(dirname "$0")" && pwd)
PORT=$(cd "$AQUI/../.." && pwd)
DIST=${DB_DIST:-$PORT/web2/dist}

for f in "$PORT/sitio/publico/index.html" "$PORT/sitio/generar.mjs" "$DIST/index.html" "$PORT/build-wasm/dbcore.js" "$PORT/build-wasm/dbcore.wasm" "$PORT/web/index.html" "$PORT/web/worker.js"; do
  if [ ! -f "$f" ]; then
    echo "falta $f" >&2
    exit 1
  fi
done

case "$DEST" in
  "" | / | //)
    echo "destino inválido: '$DEST'" >&2
    exit 2
    ;;
esac
if [ -e "$DEST" ]; then
  DEST_ABS=$(cd "$DEST" && pwd -P)
  for prohibido in / "$PORT" "$PORT/.." "$PORT/web2" "$DIST" "$PORT/web" "$PORT/build-wasm" "$PORT/sitio" "$PORT/sitio/publico"; do
    if [ "$DEST_ABS" = "$(cd "$prohibido" 2>/dev/null && pwd -P)" ]; then
      echo "destino inválido: '$DEST' ($DEST_ABS)" >&2
      exit 2
    fi
  done
  rm -rf "$DEST"
fi

mkdir -p "$DEST/app"
cp -R "$PORT/sitio/publico/." "$DEST/"
cp -R "$DIST/." "$DEST/app/"
node "$PORT/sitio/generar.mjs" --sitio "$DEST" --lint
cp -R "$PORT/web" "$DEST/classic"
mkdir -p "$DEST/build-wasm"
cp "$PORT/build-wasm/dbcore.js" "$PORT/build-wasm/dbcore.wasm" "$DEST/build-wasm/"

# Versionado de la clásica. El hosting deja cachear cada archivo: sin esto
# el navegador puede mezclar el index.html nuevo con un contest.js/worker.js
# viejo. Cada script, el worker, dbcore.js y el .wasm se piden con ?v=<version>.
sed -i -E "s#<script src=\"([a-z]+)\.js\"></script>#<script src=\"\1.js?v=$V\"></script>#; s#new Worker\('worker\.js'\)#new Worker('worker.js?v=$V')#" "$DEST/classic/index.html"
sed -i -E "s#importScripts\('\.\./build-wasm/dbcore\.js', 'imnet\.js'\)#importScripts('../build-wasm/dbcore.js?v=$V', 'imnet.js?v=$V')#; s#locateFile: \(f\) => '\.\./build-wasm/' \+ f \}#locateFile: (f) => '../build-wasm/' + f + '?v=$V' }#" "$DEST/classic/worker.js"
test "$(grep -c "\.js?v=$V" "$DEST/classic/index.html")" -ge 5
test "$(grep -c "?v=$V" "$DEST/classic/worker.js")" -ge 2

echo "sitio armado en $DEST (version $V)"
