# DarwinBots 2 in the browser — a port of the original Visual Basic program

*[Leer en español](README.md)*

> **This project is a port.** It is not a new DarwinBots: it is a faithful
> reimplementation, in C++20 compiled to WebAssembly, of
> **DarwinBots 2.48.32**, the artificial life simulator written in
> Visual Basic 6 by Carlo Comis and maintained for over a decade by its
> community. All the credit for the design, the simulation and the bots
> belongs to them; this repository only tries to keep their work running
> on modern machines.
>
> **Live demo:** https://japentaca.github.io/darwinbots2-wasm/

## The original project and its community

[DarwinBots](http://wiki.darwinbots.com/) is an artificial life simulator
(2003–2015) in which organisms with programmable DNA compete, feed, mutate
and evolve in a 2D physical world. Each bot's DNA is a small program in its
own stack-based language; bots can be written by hand or left to evolve.

**History.** Carlo Comis created it in Italy in 2002–2003 (*"Robottini
genetici!"* — "genetic little robots!" — still reads the *About* screen of
the original, which is still in Italian). From there the project passed
from hand to hand, as recorded in its [license](LICENSE.md) and in the
*About* screen itself:

| Period | Who |
|---|---|
| Original version (2002–2003) | **Carlo Comis** |
| 2004–2005 | **Purple Youko** and **Numsgil** |
| After 2.42 (2006–2007) | **Eric Lockard** (EricL) |
| After 2.44.01 | **The members of the [DarwinBots forum](http://forum.darwinbots.com/)** |
| After 2.45.1 | **Botsareus** — the version ported here is 2.48.32 |

The VB6 source was published at
[github.com/darwinbots/Darwinbots2](https://github.com/darwinbots/Darwinbots2),
which is where the tree this repository keeps untouched in
[`Darwinbots2/`](Darwinbots2/) comes from. Around the program grew a
community that for years documented the DNA language and the system
variables in the [wiki](http://wiki.darwinbots.com/), discussed strategies
on the forum, ran leagues and contests (F1, F2, F3, multi-bots…) and, above
all, **wrote bots**. That community is the reason this port exists.

### Where the demo's bots come from

The page includes a **Bestiary of 588 real bots**, written by the community
and published over the years in the
[forum's Bestiary](http://forum.darwinbots.com/) (board 13 and its
sub-boards). None of them was written or modified for this port:

- All 12 Bestiary sub-boards were crawled: F1 (143 bots), F2 (130),
  *Interesting behaviour* (64), *Short* (58), *Multi-Bots* (54),
  *Mutations* (38), *Untagged* (34), F3 (29), *Veggies* (19),
  *Single store* (13), *EcoSim* (3) and *The Starting Gate* (3).
- From each topic the published DNA was taken: the author's `.txt`
  attachments when they existed and, otherwise, the most complete code
  block of the first post. The only normalization was of invisible
  characters (`&nbsp;`, zero-width spaces) that the forum had introduced.
- Every candidate was validated **with the ported engine itself**, not with
  heuristics: it is loaded, seeded and run for 50 cycles. All 753
  candidates passed, and one bot per topic was published.
- In the page's selector each bot keeps the name its author published it
  under, and `port/web/bots/bots.json` stores the link to the original
  forum topic, where the authorship and the discussion live.

The details of the process are in
[`port/tools/bestiary/README.md`](port/tools/bestiary/README.md) (in
Spanish).

### Thanks

To Carlo Comis for the idea and the original code; to Purple Youko,
Numsgil, EricL and Botsareus for keeping it alive; to everyone who wrote
the wiki, which documented the bot language and settled questions the
source alone could not answer; and to every person who published a bot on
the forum. If one of the demo's bots is yours and you would like it
removed or credited differently, please open an *issue*.

There were other attempts to bring DarwinBots to new platforms, such as
[DarwinbotsC](https://github.com/darwinbots/DarwinbotsC) or
[DarwinBots.Js](https://github.com/BradleyLyman/DarwinBots.Js); this
repository follows in their footsteps.

## What's in this repository

The original is a Visual Basic 6 application that no longer runs on modern
Windows. This repository contains **three layers, in order of
derivation**:

| Layer | What it is |
|---|---|
| [`Darwinbots2/`](Darwinbots2/) | The original DarwinBots **2.48.32** source (VB6, 53,327 LOC). **Read-only**: it is the ultimate authority. Baseline at commit `02b20d7`; `git diff 02b20d7 -- Darwinbots2/` must always be empty. |
| [`spec/`](spec/) | The **complete specification** extracted from the source (in Spanish): simulation cycle, DNA VM (77 opcodes), memory map (247 sysvars), physics, vision, shots, ties, viruses, reproduction, mutations, world and file formats — including the catalog of the original's bugs, which are replicated as-is. [`spec/70-CASOS-DORADOS.md`](spec/70-CASOS-DORADOS.md) is the golden test suite; [`spec/PROGRESO.md`](spec/PROGRESO.md) is the authoritative status. |
| [`port/`](port/) | The **reimplementation**: a header-only C++20 core, bit-for-bit faithful to the original, compiled natively (g++/clang) and to WebAssembly (Emscripten), with the sim running in the browser on a Web Worker and Canvas 2D rendering. |

The remaining top-level directories (`DBLaunch/`, `Installer/`,
`LocalDBIM/`, …) are companion tools from that era, part of the original
source drop and kept untouched.

## Status

**The port is complete and usable.** All 10 milestones closed and verified:

- **143 golden cases / 2,962 assertions passing in three build modes** —
  native g++, native clang and WASM under node — without a single numeric
  divergence (VB6 banker's rounding, exact LCG, `Single`/`Double` with VB6
  semantics, no `-ffast-math`, no implicit FMA).
- The original's `[PROBABLE BUG]`s (35 catalogued) are replicated and
  asserted by tests: fidelity includes the bugs.
- A web page with the full sim: physics and RNG live in `dbcore.wasm`
  inside a Web Worker; the page only presents. It includes saving/loading
  the sim in the VB6 binary format and the **Bestiary of 588 community
  bots** (see [Where the demo's bots come from](#where-the-demos-bots-come-from)).

The milestone-by-milestone detail, with hashes and dates, is in
[`spec/PROGRESO.md`](spec/PROGRESO.md).

## Building and running the tests

Requirements: CMake ≥ 3.25 + Ninja, g++ and/or clang++, and for WASM the
[emsdk](https://emscripten.org/) (`EMSDK` environment variable) and node.
Details of the verified toolchain in [`port/README.md`](port/README.md).

```sh
cd port
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
```

## Running the sim in the browser

```sh
cd port && python -m http.server 8000
# → http://localhost:8000/web/
```

(Requires the `wasm` preset to be built: it produces `build-wasm/dbcore.js`
+ `dbcore.wasm`, which the worker consumes.)

## Project rules

1. `Darwinbots2/` is read-only; the VB6 source **is** the spec whenever
   something needs disambiguating.
2. Everything touching `port/core/` follows the cycle: golden case failing →
   implementation transcribed from the source, cited line by line →
   passing → commit citing the spec section.
3. The original's bugs are replicated, not fixed.
4. The JS/render layer never recomputes physics or RNG: it only presents
   what the core outputs.

## License

The original source is copyright 2003 Carlo Comis, with modifications by
Purple Youko and Numsgil (2004–2005), Eric Lockard (2006–2007) and the
members of the DarwinBots forum, distributed under the BSD-style license
in [`LICENSE.md`](LICENSE.md). The port in `port/` and the specification in
`spec/` are derivative works of that source and are distributed under the
same license, including its non-commercial clause. The Bestiary bots belong
to their authors.
