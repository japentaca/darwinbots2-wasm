# Dudas de la traducción: lo que queda por decidir

De las 128 dudas que dejaron los revisores de la traducción al inglés (S-E,
2026-10-06): 82 se corrigieron (en español y en inglés) tras verificarlas
contra el motor y la spec, y 39 resultaron no ser error. Quedan estas cinco (las siete notas originales, agrupadas),
que cambian la voz del manual o la app y las decide el autor:

1. **Clavado / fijo / anclado** (`.fixed`, `.fixpos`): el español alterna los
   tres términos en decenas de páginas (fisica, multibots, parasitos,
   parametros-restricciones, inspector). El inglés ya dice «anchored».
2. **«Tocá» o «hacé clic»**: «tocá/tocar» aparece ~49 veces (tutoriales, app,
   técnico) contra ~16 de «hacé clic». Propuesta: «hacé clic».
3. **«Plant» en la app en inglés** (`observar.sembrar.vegetal`,
   `observar.sembrar.preset.alga`, `inicio.categoria.vegetal` y cadenas de
   analizar): el glosario manda «vegetable». Cambiarlo toca
   `web2/src/i18n/en` y, después, `tutoriales/alimentador` y `busca-comida`
   en inglés, que citan la etiqueta de la app.
4. **`*.nombre` / `.nombre` y la fila `propio` de `app/bots`**: en inglés
   quedaron traducidos (`*.name`, `mine`, como muestra la app). Se puede dejar
   idéntico al español.
5. **Espacio antes del %** en inglés: ~55 casos «10 %» y ~25 «10%». Propuesta:
   normalizar todo a «10%» en una pasada.
