---
titulo: Dirección 0
resumen: "Una celda interna que el ADN no puede leer ni escribir: el motor la usa para desviar los ataques de veneno y toxina dirigidos a .delgene."
etiquetas: [memoria, veneno, toxina, delgene]
estado: revisada
---
<!-- 21-MEMORIA §6 (mem(0): nunca se lee, no alcanzable desde el ADN); 20-VM §0.6, §7 (0 al leer → 1000; store a 0 no-op sin costo) -->
Por dentro, la memoria de un bot tiene una celda más que las 1000 que ve el ADN: la
0. Tu ADN no puede llegar a ella. Al leer, el 0 cae en la 1000 (`*0` lee la celda
1000), y un store a la dirección 0 no hace nada ni cobra energía (ver
[[adn/numeros#cero]] y [[adn/stores]]).

<!-- 21-MEMORIA §6 (Vloc/Ploc = (memloc-1) Mod 1000 + 1; 340 → 0; Poisons P1 escribe cada ciclo), §4.3 -->
La usa solo el motor, como protección. Cuando un bot te paraliza con veneno, su
[[.vloc]] elige en qué celda tuya se escribe el efecto; cuando vos te envenenás con
la toxina de otro por atacarlo, es su [[.ploc]]. Mientras dura el efecto, el motor
escribe en esa celda en cada ciclo. Si la celda es la 340 ([[.delgene]], la que
borra genes), el motor la cambia por la 0: el golpe va a parar a esta celda y no le
borra genes a nadie. Nadie lee lo que queda ahí.

En la práctica, para vos no existe: no la podés usar como variable, y lo que el
motor deje en ella no afecta a tu bot. Lo que sí importa es la consecuencia: un
`.vloc` o un `.ploc` en 340 no le borra genes a nadie. Las defensas químicas se
cuentan en [[simulacion/defensas]].
