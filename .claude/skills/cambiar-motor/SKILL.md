---
name: cambiar-motor
description: Procedimiento para modificar el motor C++ (port/core) o la API wasm (port/wasm) sin perder la fidelidad al DarwinBots 2.48.32 original. Usala antes de tocar port/core/, port/wasm/ o los tests C++.
---

# Cambiar el motor

El core es una transcripción fiel del fuente VB6 (`Darwinbots2/`, solo
lectura). La spec (`spec/`) se extrajo de ese fuente; cuando dudan, manda el
fuente.

## Ciclo obligatorio

1. Ubicá la sección de la spec (`spec/10-CICLO.md`, `20-VM.md`, …) y las
   líneas del fuente VB6 que gobiernan el comportamiento.
2. Escribí el caso en `port/tests/test_*.cpp` (doctest) y comprobá que **falla**.
3. Implementá transcribiendo el fuente, citando archivo y rutina en el comentario.
4. Verde en los tres modos (gcc, clang, wasm): ver skill `verificar-cambios`.
5. Commit citando la sección de la spec.

## Reglas numéricas

- Float→int marcado por la spec: `vb_round64` / `vb_clng` (redondeo bancario).
- `Single`/`Double` con semántica VB6; nada de `-ffast-math`;
  `-ffp-contract=off` (sin FMA implícita).
- Sitios de error 6/9/11 del original: comportamiento explícito documentado
  y registro en `VmDiag` (`spec/10-CICLO.md` §14).

## Bugs del original

Se corrigen solo si el lenguaje del ADN no cambia: un bot existente tiene que
seguir significando lo mismo. Toda corrección se anota en `port/README.md`
(«Bugs del original corregidos») y en `manual/es|en/tecnico/diferencias.md`.
Si cambia el comportamiento de una rutina ya revisada, avisá al autor: la
revisión contra VB6 (`spec/REVISION-PORT.md`) tendría que volver a verla.

## API wasm

`port/wasm/dbcore_api.cpp`: los exports nuevos para la app son de **solo
lectura**; `tests/wasm/solo_lectura.mjs` comprueba que el `.dbsim` sale
idéntico byte a byte. La app (`port/web2`) nunca recalcula física ni RNG.

## Después

Un cambio de comportamiento casi siempre toca el manual (simulación, fichas
de sysvars u operadores) en los dos idiomas: seguí la skill
`actualizar-documentacion`.
