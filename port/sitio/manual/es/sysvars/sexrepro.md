---
titulo: .sexrepro
resumen: "Ordena una reproducción sexual: solo funciona si el bot fue fecundado, y el hijo mezcla su ADN con el del esperma."
etiquetas: [reproducción, sexual, esperma, acción]
estado: revisada
---
<!-- 36-REPRO §0.2, §3.1 (esperma = shot −8; fecundación de 10 ciclos) -->
La reproducción sexual tiene dos papeles. El que hace de padre no tiene hijos: le
dispara esperma a otro bot con `-8 .shoot store` (ver [[.shoot]]). El que lo recibe
queda fecundado unos diez ciclos ([[.fertilized]] se lo dice), y si en ese plazo
escribe un porcentaje en `.sexrepro`, tiene un hijo cuyo ADN mezcla el suyo con el
del esperma.

```adn
' Gira hasta ver algo y le dispara esperma
cond
 *.eye5 0 =
start
 25 .aimdx store
stop
cond
 *.eye5 0 >
start
 -8 .shoot store
stop
' Si la fecundaron, tiene un hijo con la mitad de lo suyo
cond
 *.fertilized 0 >
start
 50 .sexrepro store
stop
```

<!-- comprobado: dos de estos bots en un campo de 1000×1000 tienen un hijo antes del ciclo 50 en 5 de 6 semillas -->
Con dos de estos bots en un campo chico, lo normal es que nazca un hijo en unas
decenas de ciclos. El hijo aparece delante de la madre, hacia donde apunta: si ahí
hay otro bot o una pared, el parto espera. El porcentaje funciona como en
[[.repro]]: módulo 100, y la orden queda escrita hasta que el parto sale bien.

<!-- 36-REPRO §0.2, §0.3, §3.1, §3.4, §5.3; port/README A1-5 -->
Lo que cambia respecto de la asexual:

- **Todo lo pone la madre.** Energía, cuerpo y cloroplastos del hijo salen del bot
  que escribe `.sexrepro`. El que disparó el esperma solo pagó el disparo, y no
  figura como padre.
- **Un esperma, un hijo.** Después del parto la fecundación se termina y
  `.fertilized` vuelve a 0.
- **Parientes, no extraños.** Si el ADN del esperma es demasiado distinto (más de un
  60 % de diferencias), no hay hijo, ese esperma ya no sirve y durante unos ocho
  ciclos el bot no acepta esperma nuevo. Para volver a intentarlo necesita que le
  llegue otro.
- **La mezcla no es fija.** Dos partos con el mismo esperma dan hijos distintos, y
  el hijo puede salir más corto que los dos.
- **Va antes que la asexual.** Mientras el bot esté fecundado y tenga `.sexrepro`
  escrita, solo intenta la sexual; [[.repro]] espera aunque la sexual falle.

Cómo se arma el ADN del hijo está en [[simulacion/reproduccion]].
