---
titulo: .genes
resumen: "Cuántos genes tiene el ADN del bot; cambia si muta, si se borra un gen o si un virus le inserta uno."
etiquetas: [genes, ADN, sentido, virus]
estado: revisada
---
<!-- sysvars.yaml .genes (pinned cada P3 + carga, nacimiento, mutación, delgene, addgene); 35-VIRUS §3 (addgene recalcula genenum); comprobado: se lee desde el primer ciclo -->
El motor cuenta los genes del ADN con la misma regla con que los numera (ver
[[adn/genes#la-numeracion-de-los-genes]]) y publica el total acá. A diferencia de
[[.nrg]] o [[.body]], ya está publicado desde el primer ciclo, porque se calcula al
cargar el bot y al nacer.

Cambia cuando cambia el ADN: un gen borrado con [[.delgene]], un virus que se
insertó (ver [[sysvars/adn-y-virus]]) o una mutación. Por eso sirve para darse
cuenta de que algo de afuera te tocó el ADN:

```adn
' Al nacer anota cuántos genes tiene
cond
 *.robage 0 =
start
 *.genes 60 store
stop
' Si ahora tiene más, le metieron un virus: lo anota en la 61
cond
 *.genes *60 >
start
 1 61 store
stop
```

Saber cuál es el gen intruso es otra cosa: un virus entra en un lugar al azar, así
que los números de tus propios genes pueden correrse. Escribir en `.genes` no sirve:
el motor la reescribe cada ciclo. El largo en palabras está en [[.dnalen]].
