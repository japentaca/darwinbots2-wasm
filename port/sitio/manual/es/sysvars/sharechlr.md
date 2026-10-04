---
titulo: .sharechlr
resumen: "En un organismo multicelular, reparte los cloroplastos con cada bot atado: el número es el porcentaje del total que se queda este bot."
etiquetas: [cloroplastos, lazos, multicelular, acción]
estado: revisada
---
<!-- sysvars.yaml .sharechlr (Update_Ties P3, solo multibot, clamp 0..99, =0 cada P3); 34-TIES §2.1; 36-REPRO §4 (umbral 0,25) -->
Funciona solo en un organismo multicelular, es decir, un bot que ya endureció al
menos un lazo (ver [[simulacion/lazos]]). Por cada lazo que creó este bot, el motor
suma sus cloroplastos y los del otro y los vuelve a repartir: el valor de
`.sharechlr` es el porcentaje del total que se queda este bot, y el resto va al
otro. `50 .sharechlr store` los empareja; `20 .sharechlr store` le pasa al otro la
mayor parte.

Detalles que conviene saber:

- El valor va de 1 a 99 (con 0 no reparte): un número mayor cuenta como 99.
- Se aplica en el mismo ciclo y la celda se vuelve a 0 en todos los bots, tengan
  lazos o no. Para compartir de forma continua, escribila cada ciclo.
- Solo comparte con parientes cercanos. Si el ADN de los dos bots difiere más de un
  25 %, no hay reparto y el bot queda bloqueado para compartir cloroplastos durante
  8 ciclos de sol (la espera no corre de noche).
- Solo cuentan los lazos que creó este bot. En un lazo que creó el otro, el reparto
  lo decide el `.sharechlr` del otro.

```adn
' Reparte cloroplastos en partes iguales con las células vecinas
cond
 *.chlr 0 >
start
 50 .sharechlr store
stop
```

Las otras órdenes de reparto funcionan de forma parecida: [[.sharenrg]], [[.sharewaste]],
[[.shareshell]] y [[.shareslime]].
