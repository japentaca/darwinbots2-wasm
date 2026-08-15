# Archivado del wiki de Darwinbots + informe de discrepancias

> **Corré esto en una sesión y una carpeta separadas de la extracción de spec.**
> La Fase A se puede hacer en cualquier momento (cuanto antes mejor: el wiki puede desaparecer).
> La Fase B **sólo después** de que `spec/` esté terminada, y nunca en la misma sesión que la escribió.

---

# FASE A — Archivado

## Objetivo

Bajar una copia local, completa y offline del wiki de Darwinbots (`wiki.darwinbots.com`), en formato limpio y con metadatos, para consulta y para el diff posterior.

## Método

Es un MediaWiki. **No scrapees HTML.** Usá la API y `Special:Export`:

- `api.php?action=query&list=allpages&aplimit=500` (paginado con `apcontinue`) para el índice completo de páginas, incluyendo todos los namespaces relevantes.
- `Special:Export` o `action=raw` para obtener el **wikitext**, no el HTML renderizado.
- Para cada página, capturá y guardá: título, URL canónica, namespace, **fecha de última edición**, número de revisión y categorías.

Escribí un script (Python o shell) en vez de hacer requests una por una desde tus herramientas: es más rápido, reanudable y no consume contexto. Guardalo en `wiki-archive/tools/`.

**Sé respetuoso con el servidor**: máximo 1 request por segundo, User-Agent identificable, y reanudable si se corta.

## Salida

```
wiki-archive/
  raw/            wikitext crudo, un archivo por página
  md/             conversión a markdown legible
  index.json      manifiesto: título, url, namespace, fecha_edicion, revision, categorias
  bots/           todo fragmento de ADN encontrado en las páginas, extraído a archivos sueltos
  INFORME.md      qué se bajó, qué falló, cobertura, distribución de fechas
```

## Detalles importantes

1. **La fecha de última edición es metadato de primera clase.** El wiki abarca de ~2006 a ~2014, período en el que el motor cambió. Una página vieja puede describir un comportamiento que ya no existe. En `INFORME.md` mostrame el histograma de fechas y qué páginas son las más antiguas.
2. **Extraé todo el ADN.** Cualquier bloque que parezca DNA de Darwinbots (`cond`, `start`, `stop`, `def`, `*.algo`) va a `bots/` como archivo individual, con un `.meta.json` que apunte a la página de origen. Este es el corpus de test más barato que vas a conseguir.
3. Bajá también las páginas de discusión (`Talk:`) si existen: suelen contener las correcciones y los desacuerdos que nunca llegaron al artículo.
4. Si hay enlaces a descargas (sysvars.txt, bots, versiones del programa), listalos en `INFORME.md` pero no los bajes sin preguntarme.

---

# FASE B — Informe de discrepancias

> **Precondición: `spec/` completa. No arranques esta fase si falta algún documento de la Fase 1 de la extracción.**

## Objetivo

Comparar lo que dice el wiki contra lo que dice el código, y producir un catálogo de divergencias.

## Reglas duras

1. **La spec derivada del fuente es la autoridad. El wiki no corrige la spec.** Si hay conflicto, gana el código.
2. **Bajo ninguna circunstancia edites `spec/` en esta fase.** El único output es `wiki-diff/`.
3. Toda discrepancia cita ambos lados: `archivo:línea` del fuente (vía la spec) y página + fecha de edición del wiki.

## Trabajo

Recorré el wiki subsistema por subsistema, siguiendo la misma división que `spec/`, y para cada afirmación verificable del wiki determiná si **coincide**, **contradice** o **agrega** respecto de la spec.

Sólo interesan las dos últimas. Clasificá cada una:

- `[WIKI-ERRÓNEO]` — el wiki dice algo que el código nunca hizo. Anotá qué bots podrían haberse escrito creyendo eso.
- `[DERIVA-VERSIÓN]` — el wiki describe un comportamiento plausible de otra versión del motor. Usá la fecha de edición como evidencia.
- `[BUG-RACIONALIZADO]` — el código hace algo raro y el wiki lo documenta como si fuera intencional. **Estos son los más importantes**: son las dependencias no obvias del corpus evolucionado.
- `[NO-EN-FUENTE]` — el wiki aporta información que el código no puede dar: intención de diseño, unidades, rationale, idiomas de la comunidad.
- `[HUECO-RESUELTO]` — el wiki responde algo que en `spec/OPEN_QUESTIONS.md` quedó `[SIN VERIFICAR]`. **No lo promuevas a spec**: dejalo como hipótesis a confirmar leyendo el fuente en una pasada posterior.

## Salida

```
wiki-diff/
  00-RESUMEN.md         hallazgos ordenados por impacto sobre el port
  10-ciclo.md           un archivo por subsistema, espejando spec/
  20-vm.md
  ...
  hipotesis.md          los [HUECO-RESUELTO], para verificar contra el fuente
```

En `00-RESUMEN.md`, cerrá con: los cinco hallazgos que más condicionan el diseño del port, y los bots del corpus que más probablemente dependan de un `[BUG-RACIONALIZADO]`.
