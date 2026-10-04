---
titulo: .out1
resumen: "Primer canal de salida por la vista: el número que escribís acá lo lee en su .in1 cualquier bot que te esté mirando."
etiquetas: [comunicacion, out, in, especie]
estado: revisada
---
Lo que guardás en `.out1` queda publicado para los demás. Cuando otro bot te
tiene en su ojo con foco (normalmente [[.eye5]], el de adelante; se cambia con
[[.focuseye]]), el motor copia tu `.out1` en su [[.in1]]. También pasa cuando te
choca, aunque no te esté viendo. El otro lo lee recién en el ciclo siguiente.
<!-- sysvars.yaml .out1; 32-VISION §4 (lookoccurr en visión y en colisión); 21-MEMORIA §3 (in*: latencia 1) -->

El motor no la borra nunca: escribirla una vez alcanza y el valor queda hasta que
lo cambies. Por eso muchos bots la escriben solo al principio de su vida. Un hijo,
en cambio, nace con `.out1` en 0 y tiene que escribirla él mismo.
<!-- sysvars.yaml .out1 (borra: no); 36-REPRO §2 (el hijo no hereda mem) -->

Su uso clásico es un código de especie para no atacar a los propios. Así lo hace
_Artemis Minimalis_, del Bestiario:

```adn
cond
*.robage 5 <
start
555 .out1 store
stop
```

Y después, antes de disparar, compara `*.in1 *.out1 !=`. Usá un código distinto
de 0, que es lo que publica cualquiera que no usa el canal. Tené en cuenta que el
canal es público: cualquier bot que te mire lo lee, sea de tu especie o no.

<!-- Artemis_Minimalis.txt: 555 .out1 store con *.robage 5 <, y *.in1 *.out1 != antes de -1 .shoot -->

Hay diez canales iguales, de `.out1` a [[.out10]]; ver
[[sysvars/entradas-salidas]].
