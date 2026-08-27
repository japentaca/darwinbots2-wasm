'use strict';
// Valida los candidatos del crawler con el core real: dbcore.wasm bajo node.
// Un candidato es válido si db_sim_seed_species logra insertar el fundador
// (InsertFounder acepta el ADN), su bot_text tiene al menos un gen cerrado
// y la sim aguanta 50 ticks sin reventar.
//
// Uso: node validate_bots.js <dir_bots_raw> <salida.json>
const fs = require('fs');
const path = require('path');
const createDbCore = require(
  path.resolve(__dirname, '../../build-wasm/dbcore.js'));

const RAW = process.argv[2];
const OUT = process.argv[3];

(async () => {
  const M = await createDbCore();
  const C = (n, r, a) => M.cwrap(n, r, a);
  const api = {
    create:      C('db_sim_create', 'number', []),
    destroy:     C('db_sim_destroy', null, ['number']),
    start:       C('db_sim_start', null, ['number', 'number']),
    tick:        C('db_sim_tick', null, ['number']),
    setField:    C('db_sim_set_field', null, ['number', 'number', 'number']),
    addSpecies:  C('db_sim_add_species', 'number',
                   ['number', 'string', 'string', 'number', 'number', 'number', 'number', 'number']),
    seedSpecies: C('db_sim_seed_species', 'number', ['number', 'number', 'number']),
    totalRobots: C('db_sim_total_robots', 'number', ['number']),
    botText:     C('db_sim_bot_text', 'number', ['number', 'number']),
    free:        C('db_free', null, ['number']),
  };

  const rawIndex = JSON.parse(
    fs.readFileSync(path.join(RAW, 'raw_index.json'), 'utf8'));
  const results = [];
  let ok = 0, bad = 0;

  for (const entry of rawIndex) {
    const file = path.join(RAW, entry.file);
    let dna;
    try { dna = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const veg = entry.board === 26 ? 1 : 0;
    let verdict = 'ok', genes = false;
    const sim = api.create();
    try {
      api.setField(sim, 9237, 6928);
      api.start(sim, 42);
      const idx = api.addSpecies(sim, dna, path.basename(entry.file), veg, 0,
                                 3000, 0x40FF40, 1);
      const inserted = api.seedSpecies(sim, idx, 1);
      if (inserted !== 1) {
        verdict = 'rechazado por el cargador';
      } else {
        const p = api.botText(sim, 1);
        if (p) {
          const txt = M.UTF8ToString(p);
          api.free(p);
          genes = /\bstop\b/.test(txt);
        }
        if (!genes) verdict = 'sin genes (parseó vacío)';
        else for (let t = 0; t < 50; t++) api.tick(sim);
      }
    } catch (e) {
      verdict = 'excepción: ' + e.message;
    }
    try { api.destroy(sim); } catch {}
    const valid = verdict === 'ok';
    valid ? ok++ : bad++;
    results.push({ ...entry, veg: veg === 1, valid, verdict });
  }

  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log(`válidos ${ok} / rechazados ${bad} (total ${results.length})`);
})();
