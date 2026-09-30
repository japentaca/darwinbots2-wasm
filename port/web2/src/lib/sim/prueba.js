// @ts-check
// Sim de prueba con la que arranca Observar si todavía no hay ninguna:
// semilla 1234, las opciones con las que arranca la clásica (base 'clasica'
// de engine/opciones.js) y los presets Animal Minimalis + Alga Minimalis
// (port/web/index.html, PRESETS). Provisoria hasta que Inicio ofrezca los
// escenarios de fábrica.

import { opcionesReset, valoresResueltos } from '../../../engine/opciones.js';
import { cssAVb } from '../mundo/color.js';

export const SEMILLA_PRUEBA = 1234;

const ANIMAL = `' Animal Minimalis
' Gene 1 Food Finder
cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refveldx .dx store
*.refvelup 30 add .up store
stop

' Gene 2 Eat Food
cond
*.eye5 50 >
*.refeye *.myeye !=
start
-1 .shoot store
*.refvelup .up store
stop

' Gene 3 Avoiding Family
cond
*.eye5 0 =
*.refeye *.myeye = or
start
314 rnd .aimdx store
stop

' Gene 4 Reproduce
cond
*.nrg 20000 >
start
10 .repro store
stop
end
`;

const ALGA = `' Alga Minimalis
' Gene 1 Reproduce
cond
*.nrg 5000 >
start
50 .repro store
stop

' Gene 2 turn
cond
*.fixpos 0 =
start
628 rnd 314 sub .aimdx store
stop
end
`;

/** @returns {import('./conexion.js').EspecieSiembra[]} */
export function especiesPrueba() {
  return [
    {
      name: 'Animal_Minimalis.txt',
      dna: ANIMAL,
      veg: false,
      qty: 5,
      nrg: 3000,
      color: cssAVb('#ff4040'),
    },
    {
      name: 'Alga_Minimalis.txt',
      dna: ALGA,
      veg: true,
      qty: 15,
      nrg: 3000,
      color: cssAVb('#30d030'),
    },
  ];
}

/** Mensaje de reset de la sim de prueba (sin el `t`). */
export function resetPrueba() {
  return {
    seed: SEMILLA_PRUEBA,
    options: opcionesReset(valoresResueltos('clasica')),
    species: especiesPrueba(),
  };
}
