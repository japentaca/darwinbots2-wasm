---
titulo: How the port is built
resumen: "The technical story of the port: the spec that described the original, the engine rewritten in C++ and compiled to WebAssembly, the two web interfaces, and how everything is tested and published."
etiquetas: [architecture, webassembly, spec, tests, deployment]
estado: revisada
---
This page is for anyone who wonders what is behind the app: where the
engine came from, how it was rewritten for the browser, and how this
site is put together. You don't need any of this to use DarwinBots
(start with [[empezar/que-es]]), but if you're curious, here is the
whole map.

## The original {#original}

DarwinBots was born as a desktop program for Windows, written in
Visual Basic 6: a single executable holding the simulation, the editor
and the graphics, with more than 53,000 lines of code. Carlo Comis
created it in Italy in 2002 and 2003, and for over a decade its
community kept it going: Purple Youko and Numsgil, Eric Lockard (EricL),
the forum members and Botsareus. The version that runs here is
**2.48.32**, the last of that line. Who all these people are, with names
and dates, is in [[tecnico/creditos]].
<!-- README.md §Historia, §Qué hay en este repositorio -->

Visual Basic 6 is technology from another era: its programs no longer
run on modern Windows. This repository exists so that the work of that
community doesn't become inaccessible.
<!-- README.md §Qué hay en este repositorio -->

## The port, step by step {#el-port}

The port was built in three steps, in this order:

1. **Understand and write the spec.** Before writing a
   single line of the new engine, the original source was read line by
   line and described in full: the exact order of the cycle, the machine
   that runs the DNA, the 247 named memory addresses, the physics,
   vision, shots, ties, viruses, reproduction, mutations, the world and
   the file formats — and also the catalog of the original's bugs. That
   description lives in the `spec/` folder of the repository.
   <!-- README.md §Qué hay en este repositorio; spec/PLAN.md §Principio rector -->
2. **Rewrite the engine in C++.** With the spec written, the engine was
   rewritten in C++20, subsystem by subsystem, and compiled to
   WebAssembly so it runs in the browser.
   <!-- port/HISTORIA.md §Milestones (M1..M9); README.md §Qué hay en este repositorio -->
3. **The web.** On top of the compiled engine came first the classic
   interface; then the new app that this manual describes; and finally
   this site, with the generated manual.
   <!-- port/HISTORIA.md §Milestones (M10); port/web2/PLAN-SITIO.md §Despliegue -->

The order is no accident. Rewriting a 53,000-line engine “by eye” would
have produced a simulator that was _similar_, not the same. The spec
turned the question “what does this do?” into an answer you can verify
before the port existed, and every piece of the new engine was written
against it.
<!-- spec/PLAN.md §Principio rector -->

## Today's architecture {#arquitectura}

The central piece is the engine: a C++ library with no interface, which
doesn't know how to draw or touch the disk. It is compiled with
Emscripten to a WebAssembly file (`dbcore.wasm`), a format that the
browser runs on your own machine. For you that means three things: you
install nothing, the simulation runs on your computer (not on a server),
and both interfaces use exactly the same engine.
<!-- README.md §Estado (la física y el RNG viven en dbcore.wasm); port/README.md §Build -->

```
   Darwinbots2/  the original source (VB6, read-only)
         │    was read and described in
   spec/       the specification + the golden cases
         │    was rewritten in C++ and compiled
   port/core ─── Emscripten ──▶ dbcore.wasm (a single file)
                                    │ runs inside a Web Worker
                ┌──────────────────┴──────────────────┐
         the new app (/app/)               the classic one (/classic/)
                └── they share the wasm and the Bestiary ───┘
```

Outward, the engine exposes a small, explicit API: create a simulation
and advance it cycle by cycle, set the parameters, seed species, request
the state of everything so it can be drawn, save and load. Files (see
[[tecnico/formatos]]) travel through memory, not through the disk: the
engine packs and unpacks the bytes, and whoever calls it decides where to
store them.
<!-- port/HISTORIA.md §Milestones (M10: la API completa hacia JS) -->

The simulation runs in a _Web Worker_, a separate browser thread: no
matter how heavy the cycle is, the page never freezes, and each frame
reaches the interface as a single buffer ready to draw. The project's
rule is strict: the presentation layer never recalculates physics or
randomness, it only shows what the engine dumps. That is why the new app
and the classic one, however different, give identical runs.
<!-- port/HISTORIA.md §Página web (worker, ArrayBuffer transferible); README.md §Reglas (4) -->

On top of the engine there are two interfaces. The **classic** one was
the first web version: closer to the original program and in English;
today it is frozen and published at `/classic/` (see [[app/clasica]]).
The **new app** is the one this manual describes: in Spanish and
English, with runs, analysis, an editor and tournaments (see
[[empezar/recorrido]]). Both share the same wasm and the same
**Bestiary**: the community's bots, indexed with their profile and
genes, which the library offers for seeding (see [[app/bots]]).
<!-- port/web2/PLAN.md decisiones 1 y 5; port/HISTORIA.md §Página web (Bestiary); .github/workflows/sitio.yml (/build-wasm/ compartido) -->

The **manual** you're reading is generated too. The pages are written by
hand, but the entries for each sysvar, each operator and each parameter
come from the spec data, and a Node generator produces static HTML: each
page is a file you can read without JavaScript. Only the search box and
the theme switch use a few dozen lines. The manual's DNA blocks are
colored with the editor's highlighter, pass the same lint as your bots,
and carry two buttons: **Open in the app**, which takes you to the editor
with that DNA already loaded, and **Copy**, to paste it wherever you
like.
<!-- port/web2/PLAN-SITIO.md S5, S6, S9, S10; port/sitio/generar.mjs (bloques adn: «Abrir en la app» → /app/#/bots/nuevo?adn=…, y «Copiar», con plantilla/manual.js); la app abre el diálogo de bot nuevo con ese ADN (src/screens/Bots.svelte) -->

## The spec, arbiter of the port {#la-spec}

The spec is not courtesy documentation: it is the contract. It was
written _from_ the original source and _before_ the new engine, with a
golden rule: **the source is the spec**. No interpreting from memory or
turning to the wiki; when in doubt, you went back to the source. And the
original source is read-only: it remains intact in the repository, as
the final authority for any tiebreak.
<!-- spec/PLAN.md §Principio rector; README.md §Qué hay en este repositorio, §Reglas (1) -->

Its main tool is the **golden cases**: tests with the exact expected
result, written _before_ the implementation of each subsystem. The
workflow was always the same: the golden case red → the implementation,
transcribed from the source citing the lines → the case green → only
then, commit. The cases range from Visual Basic's banker's rounding to
the global order of the random draws within a cycle, and the whole suite
is run on three different builds of the engine. And when the spec itself
had an erratum, the spec didn't win: the source won, and the spec was
corrected.
<!-- README.md §Reglas (2); port/README.md §Estado; spec/PROGRESO.md -->

## How we check it's right {#como-se-prueba}

- **The engine suite.** 272 cases and 4126 assertions green in three
  modes: two native compilers and WebAssembly under Node, without a
  single numerical divergence. That the suite gives identical results in
  the browser and natively is the guarantee that what runs on your
  machine is the engine that was verified.
  <!-- README.md §Estado; port/README.md §Estado (2026-09-29) -->
- **CI on every push.** On every push and every PR, GitHub Actions runs
  the whole suite, the app tests, the lint and the build, and also checks
  that the original source is still intact, byte for byte.
  <!-- .github/workflows/ci.yml -->
- **The fidelity rule.** The original's bugs are only fixed if the DNA
  language doesn't change: an existing bot has to keep meaning the same
  thing. The 35 fixes, with their single exception, are documented one by
  one in [[tecnico/diferencias]].
  <!-- README.md §Reglas (3), §Estado -->
- **Deterministic randomness.** The same seed gives the same run, cycle
  by cycle; how it works is in [[tecnico/semillas]].
- **Even the Bestiary served as a test.** Every bot in the collection was
  validated with the ported engine itself: load it, seed it and run it
  for 50 cycles.
  <!-- README.md §De dónde salen los bots de la demo; re-corrido con uno al azar (Animal_Minimalis_mod_stress: carga, siembra y corre 50 ciclos sin avisos) -->
- **And the manual itself.** When it is generated, the build fails if
  there is a broken link, if the reference doesn't cover every sysvar and
  every operator the editor knows, or if a DNA block in the manual has
  lint warnings.
  <!-- port/web2/PLAN-SITIO.md S-B y S12; port/web2/test/manual.test.js -->

## How it is built and published {#el-sitio}

The `darwinbots-wasm.org` site builds and publishes itself, on every push
to the main branch:
<!-- README.md (nota inicial); .github/workflows/sitio.yml -->

1. The engine is compiled to WebAssembly — just once: both interfaces
   share the same file.
2. The new app is built and the manual is generated. If anything fails —
   a broken link, a DNA block with warnings — there is no site.
3. The complete package is assembled: the home page, `/manual/`,
   `/app/`, `/classic/` and the wasm in `/build-wasm/`.
4. It is published to Cloudflare Pages, which serves the domain.
   <!-- .github/workflows/sitio.yml (build + deploy con wrangler, proyecto darwinbots-wasm) -->

The publishing secrets live in GitHub, in an environment that only
accepts deployments from the main branch; nobody uploads anything by
hand. Changes arrive through PRs: the repository is public, anyone can
propose their own from their copy, and CI tests all of it before it is
merged.
<!-- port/web2/PLAN-SITIO.md §Despliegue y §Quién puede desplegar; .github/workflows/ci.yml (pull_request) -->

If you want to look at the work up close, the repository keeps the three
layers in order of derivation: the untouched original source, the spec
that describes it, and the port that implements it. This manual, the app
and the engine you download when you open the site all come from the
same tree.
<!-- README.md §Qué hay en este repositorio -->
