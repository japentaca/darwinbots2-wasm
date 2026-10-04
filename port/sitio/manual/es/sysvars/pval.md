---
titulo: .pval
resumen: "El valor que tu toxina escribe en la celda .ploc de quien se envenene atacándote."
etiquetas: [defensas, poison, memoria, configuración]
estado: revisada
---
Es la pareja de [[.ploc]]: `.ploc` dice _dónde_ y `.pval` _qué_. El motor la lee
cuando tu toxina sale hacia quien te atacó (ver [[.poison]]) y, si lo envenena,
desde entonces escribe ese valor en la celda `.ploc` del atacante en cada ciclo,
hasta que se le termine el envenenamiento ([[.poisoned]]).

<!-- sysvars.yaml .pval (createshot −5 y ties → Pval del envenenado); 21-MEMORIA §4.3 -->

Es configuración: no se borra, pero un recién nacido arranca con 0. Con `.ploc` en
[[.shoot]], un `.pval` de `-2` hace que el atacante regale energía; con `.ploc` en
[[.aimdx]], un número como 50 lo deja girando.

<!-- 21-MEMORIA §3 (pval persistente); comprobado con probar-adn: .ploc en .aimdx y 50 en .pval, el mordedor gira 50 por ciclo -->

```adn
' quien me muerda va a girar sin parar
cond
*.robage 0 =
start
.aimdx .ploc store
50 .pval store
stop

cond
*.poison 500 <
start
100 .strpoison store
stop
```
