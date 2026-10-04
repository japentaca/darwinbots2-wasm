---
titulo: .out2
resumen: "Canal de salida por la vista número 2: lo que escribís acá lo lee en su .in2 el bot que te esté mirando."
etiquetas: [comunicacion, out, in]
estado: revisada
---
Funciona igual que [[.out1]]: lo que guardás en `.out2` el motor lo copia en
el [[.in2]] de cualquier bot que te tenga en su ojo con foco, o que te choque,
y él lo lee en el ciclo siguiente. El motor no la borra nunca: el valor queda
publicado hasta que lo cambies. Un hijo nace con `.out2` en 0.
<!-- sysvars.yaml .out2 (borra: no); 32-VISION §4 (lookoccurr en visión y en colisión); 21-MEMORIA §3 (in*: latencia 1); 36-REPRO §2 (el hijo no hereda mem) -->

Tener diez canales sirve para publicar varias cosas a la vez sin mezclarlas. Por
ejemplo, un bot puede publicar acá un número de rol que el bot guarda en la 50 (por ejemplo, 1 = recolector y 2 = cazador):

```adn
start
*50 .out2 store
stop
```

Si lo que publicás cambia, tenés que volver a escribirlo en cada ciclo, como acá:
el motor no lo actualiza solo. Ver [[sysvars/entradas-salidas]].
