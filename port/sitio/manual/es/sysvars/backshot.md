---
titulo: .backshot
resumen: "Con un valor distinto de 0, el próximo disparo sale hacia atrás en lugar de hacia adelante."
etiquetas: [disparos, puntería, acción]
estado: revisada
---
<!-- 33-SHOTS §2.2; sysvars.yaml 900; core shots.hpp newshot (aim - PI; aimshoot pisa la dirección); probado: back.txt (no le pega al blanco de enfrente), persistencia con --set -->
Si `.backshot` vale cualquier cosa distinta de 0 cuando sale un disparo, el
tiro sale por tu espalda, en la dirección opuesta a [[.aim]], en lugar de por
el frente. Es útil para huir disparando, o para defender la retaguardia sin
tener que girar.

```adn
' algo me viene siguiendo: corro y le tiro para atrás
cond
*.shdn 0 !=
start
30 .up store
1 .backshot store
-1 .shoot store
stop
```

Algunos detalles:

- Se consume con el disparo: el motor la vuelve a 0 cuando sale un tiro. Si
  la escribís y no disparás, queda puesta hasta el próximo disparo.
- Si también escribiste [[.aimshoot]], gana `.aimshoot`, que desvía el tiro a
  partir de tu frente; `.backshot` se borra igual sin efecto.
- El tiro sigue saliendo con la pequeña desviación al azar de siempre (ver
  [[.shoot]]).

En la prueba, un bot que veía a su blanco de frente y disparaba con
`.backshot` no le pegó ni una vez.
