---
titulo: .shoot
resumen: "La orden de disparar: el número elige el tipo de disparo (−1 roba energía, −2 la regala, −3 veneno, −6 roba body, positivo escribe en la memoria del otro)."
etiquetas: [disparos, ataque, acción]
estado: revisada
---
<!-- 33-SHOTS §0.3-0.4, §2.1 (tabla de tipos, -8 esperma, -5 no disparable), §2.2 (40 + actvel; Range = (ln(vbody)·60+41) div 40 = 11 con body 1000), §3; sysvars.yaml 7; README B3-1, B3-2; core shots.hpp robshoot/newshot, robots.hpp Shooting; probado: tira.txt, memshot.txt (1050 escribe en la 50), sperm.txt (1000 da shflav -8), m9.txt (-9 no dispara); revisor: tira.txt contra blanco.txt en 1200x900 (ve en el ciclo 6; en el 8 el blanco pierde 198 y el tirador gana 209); core robshoot (nrg <= 0 sale sin disparar; default: -5, -7) -->
Escribir un número distinto de 0 en `.shoot` dispara, en este mismo ciclo, un
proyectil que sale de tu frente en la dirección de [[.aim]]. Después el motor
la vuelve a 0 siempre, haya salido el tiro o no: para disparar cada ciclo hay
que escribirla cada ciclo.

El número elige el tipo:

| Valor | Disparo | Qué hace al pegar |
|---|---|---|
| −1 | de energía | le saca energía al otro, que vuelve hacia vos |
| −2 | regalo de energía | le da energía tuya al otro |
| −3 | de veneno (_venom_) | lo paraliza; gasta tu [[.venom]] |
| −4 | de desechos | le pasa tus desechos ([[.waste]]) |
| −6 | de body | le saca body (y algo de energía), que vuelve hacia vos como energía |
| −8 | de esperma | lo fecunda con tu ADN (ver [[simulacion/reproduccion]]) |
| positivo | de memoria | escribe tu [[.shootval]] en esa dirección de su memoria |

Un disparo de memoria usa el número módulo 1000: `1050 .shoot store` escribe
en la dirección 50. La 340 ([[.delgene]]) está protegida. Y un múltiplo exacto
de 1000 da 0, que el motor convierte en un disparo de esperma. Los negativos
que no están en la tabla, como −5, −7 o −9, no disparan nada. Si tu energía
está en 0, tampoco sale nada.

El tiro sale con una pequeña desviación al azar, viaja a 40 unidades por
ciclo más tu propia velocidad y su alcance crece con tu body: con 1000 de
body dura unos 11 ciclos. Cuesta energía según la configuración de la
simulación. Nunca te pega a vos mismo, pero sí a cualquier otro, incluida tu
especie (ver [[adn/errores#especie]]).

```adn
cond
*.eye5 0 =
start
40 .aimdx store
stop

cond
*.eye5 0 >
start
-1 .shoot store
stop
```

En una prueba con un bot quieto a la vista, este bot lo encontró en 6 ciclos;
dos ciclos después el blanco había perdido 198 de energía y el tirador había
ganado 209. [[.shootval]], [[.backshot]] y [[.aimshoot]] modifican el disparo;
qué hace cada tipo en detalle está en [[simulacion/disparos]].
