# Cómo ejecutar PLAN-EDITOR.md sin atender

Receta para correr [`PLAN-EDITOR.md`](PLAN-EDITOR.md) con un agente
orquestador (Opus 5.5) que lanza subagentes de desarrollo
(`.claude/agents/desarrollador.md`, Haiku 5.5, para JS/Svelte/tests/manual;
`.claude/agents/desarrollador-motor.md`, Sonnet 5.5, para los cuatro pasos
que tocan `port/core` o `port/wasm`). Escrito el 2026-10-07.

## Lanzar

Sesión nueva de Claude Code en la raíz del repo, con Opus 5.5 como modelo
de la sesión (`/model` → Opus 5.5, o `claude --model opus`) y esfuerzo
`high` (en `/config`): el orquestador verifica y decide, no escribe
código. El esfuerzo de los subagentes está fijado en sus definiciones
(`desarrollador` high, `desarrollador-motor` xhigh) y el prompt lo
repite. Para que no se frene pidiendo permisos:

```sh
claude --model opus --dangerously-skip-permissions
```

y pegar el prompt de abajo. O, sin dejar la terminal abierta, en modo
headless con el prompt como argumento:

```sh
claude -p "<el prompt de abajo>" --model opus --dangerously-skip-permissions
``` La corrida completa lleva horas (las
builds wasm y `npm test` con wasm tardan minutos cada vez): no es señal de
que se trabó. Nada hace `git push`: los commits quedan en `main` local
para revisarlos con `git log` al volver.

## Prompt

```
Sos el orquestador de la ejecución de port/web2/PLAN-EDITOR.md en este repo.
Leé primero AGENTS.md y PLAN-EDITOR.md enteros. Después ejecutá las etapas
E1, E2, E3 y E4 en orden, paso por paso, así:

1. Por cada paso (E1.1, E1.2, …) lanzá UN subagente con la herramienta
   Agent y el prompt: «Ejecutá el paso <paso> de port/web2/PLAN-EDITOR.md.»
   (las instrucciones comunes ya están en la definición del agente):
   - Pasos E1.1, E1.2, E2.1 y E4.1 (tocan port/core o port/wasm):
     subagent_type "desarrollador-motor", effort "xhigh".
   - Todos los demás pasos: subagent_type "desarrollador", effort "high".
   Un paso por subagente; no juntes pasos.
2. Cuando el subagente termine, verificá vos mismo, sin fiarte del reporte:
   git status y git diff --stat (tamaño razonable, ningún cambio en
   Darwinbots2/, ningún archivo con CRLF), y corré los tests del paso (los
   comandos están en AGENTS.md: dbtests nativo y wasm si tocó port/core o
   port/wasm; npm test y npm run check si tocó port/web2; node
   port/sitio/generar.mjs --lint si tocó el manual). Leé el diff completo
   de los pasos del motor.
   Si falla, relanzá el mismo paso con el mismo subagent_type y el error
   literal en el prompt. A la tercera falla del mismo paso, pará: escribí
   port/web2/PLAN-EDITOR-INFORME.md con lo que pasó, commitealo y terminá.
3. Con el paso verde, hacé git commit en español: título corto que diga
   qué cambió, cuerpo con el porqué y los desvíos del plan que reportó el
   subagente. Nunca git push.
4. Al cerrar cada etapa (E1.6, E2.4, E3.5, E4.5), corré todo lo que indica
   .agents/skills/verificar-cambios/SKILL.md y comprobá que el manual quedó
   en español e inglés con las mismas anclas y que test/claves.test.js
   pasa. Si algo falta, lanzá un subagente "desarrollador" para
   completarlo antes de seguir, y commitealo.
5. Al terminar E4, hacé el bloque «Al terminar las cuatro etapas» del plan
   y escribí port/web2/PLAN-EDITOR-INFORME.md con: cifras finales de tests
   (casos/aserciones C++ en nativo y wasm, tests de npm), rutinas del core
   que cambiaron, desvíos del plan por paso, y lo que quedó fuera.
   Commiteá el informe.

Reglas que no se negocian: Darwinbots2/ no se toca; sin dependencias
nuevas (package.json no cambia); sin TypeScript; archivos en LF; sin push.
Trabajá sin pedirme confirmación: estoy ausente. Si algo te deja sin poder
avanzar, escribí el informe y terminá.
```

## Al volver

1. `git log --oneline` para ver hasta qué paso llegó.
2. Leer `port/web2/PLAN-EDITOR-INFORME.md`.
3. Los pasos del motor (E1.1, E1.2, E2.1, E4.1) cambian `vm.hpp`,
   `stacks.hpp`, `master.hpp` y `dbcore_api.cpp`: revisar esos diffs a
   mano antes de decidir el push, y anotar en `spec/REVISION-PORT.md` lo
   que corresponda.
4. Probar a mano en `npm run dev` lo que cada etapa pide en su «Cierre».
5. Decidir el push.
