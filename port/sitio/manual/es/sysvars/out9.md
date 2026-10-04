---
titulo: .out9
resumen: "Canal de salida por la vista número 9: lo que escribís acá lo lee en su .in9 el bot que te esté mirando."
etiquetas: [comunicacion, out, in]
estado: revisada
---
Funciona igual que [[.out1]]: lo que guardás en `.out9` el motor lo copia en
el [[.in9]] de cualquier bot que te tenga en su ojo con foco, o que te choque,
y él lo lee en el ciclo siguiente. El motor no la borra nunca: el valor queda
publicado hasta que lo cambies. Un hijo nace con `.out9` en 0.
<!-- sysvars.yaml .out9 (borra: no); 32-VISION §4 (lookoccurr en visión y en colisión); 21-MEMORIA §3 (in*: latencia 1); 36-REPRO §2 (el hijo no hereda mem) -->

Tener diez canales sirve para publicar varias cosas a la vez sin mezclarlas. Por
ejemplo, un bot puede publicar acá la posición vertical de lo que tiene enfrente ([[.refypos]]), para que quien lo mira sepa dónde está su presa:

```adn
start
*.refypos .out9 store
stop
```

Si lo que publicás cambia, tenés que volver a escribirlo en cada ciclo, como acá:
el motor no lo actualiza solo. Ver [[sysvars/entradas-salidas]].
