---
titulo: .shootval
resumen: "El ajuste del próximo disparo: la potencia o el alcance de un −1 o −6, cuánto regalás con un −2, o el valor que escribe un disparo de memoria."
etiquetas: [disparos, ataque, acción]
estado: revisada
---
<!-- 33-SHOTS §2.1; sysvars.yaml 8 (persiste si no se dispara); core shots.hpp robshoot (multiplicadores <=4 sin efecto, log2(x/2) arriba de 4, costo x·SHOTCOST); probado: sv.txt (0, 2, 4, -2 iguales; 8 duplica el daño), en.txt (-2 con 100: el otro gana 95), memshot.txt, persistencia con --set; revisor: core robshoot (-2/-3/-4: fabs y tope en nrg/venom/waste; -1/-6: valor y rngmultiplier > 4 pasan a log2(x/2) con costo x·SHOTCOST, recorte por nrg) -->
`.shootval` no dispara nada por sí sola: acompaña a [[.shoot]] y cambia el
disparo que sale en ese ciclo. Qué cambia depende del tipo:

- **−1 y −6 (robar energía o body).** Un valor positivo multiplica la
  potencia y uno negativo, el alcance. Pero solo a partir de 5: entre −4 y 4
  no cambia nada. Arriba de eso la escala es logarítmica: 8 duplica la
  potencia, 16 la triplica. Y se cobra: el disparo cuesta el valor por el
  costo de un disparo. Si no te alcanza la energía, el motor lo achica a lo
  que podés pagar.
- **−2 (regalar energía).** Cuánta energía mandás, sin signo y nunca más de
  la que tenés; si escribís 0, el 1% de la tuya.
- **−3 y −4 (veneno y desechos).** Cuánto mandás, sin signo y nunca más de
  lo que tenés; con 0, una vigésima parte de lo que tengas.
- **Positivo (disparo de memoria).** El valor que se escribe en la memoria
  del otro.

```adn
' le escribo 77 en la dirección 50 al que tengo enfrente
cond
*.eye5 0 >
start
77 .shootval store
50 .shoot store
stop
```

En la prueba, la celda 50 del blanco pasó a valer 77 dos ciclos después.

:::cuidado
A diferencia de `.shoot`, el motor no borra `.shootval` todos los ciclos:
solo cuando de verdad dispara. Si la escribís en un ciclo en que no
disparás, queda ahí y se aplica al próximo disparo, aunque sea de otro tipo.
Lo seguro es escribirla siempre junto con la orden de disparo.
:::
