---
titulo: .up
resumen: "Empuja al bot hacia adelante, en la dirección en que apunta; hay que escribirla en cada ciclo en que quieras empujar."
etiquetas: [movimiento, empuje, orden]
estado: revisada
---
<!-- sysvars.yaml .up; 30-FISICA §2.1 -->
`.up` es la orden de avanzar. El número que escribís es un empujón en la dirección
de [[.aim]]: el motor lo aplica en el mismo ciclo y deja la celda en 0. Si querés
seguir empujando, escribila de nuevo en cada ciclo (ver [[adn/errores#accion]]).

Es una aceleración, no una velocidad: cada empujón se suma a lo que el bot ya
traía. Con la configuración por defecto, un único `10 .up store` deja al bot
avanzando a unos 7 por ciclo; repetido ciclo tras ciclo, acelera hasta el tope de
[[.maxvel]]. Si la simulación no tiene rozamiento, el bot sigue deslizándose aunque
dejes de empujar.

<!-- 30-FISICA §2.1, §6 -->
El motor multiplica el empujón por la masa ([[.mass]]), recorta el resultado a
[[.maxvel]] y después lo divide por la masa al sumarlo a la velocidad. Mientras el
empujón por la masa no pase el tope, la masa se cancela: `10 .up store` acelera
igual a un bot liviano que a uno pesado. Pero el tope llega antes cuanto más pesa
el bot: con masa 1 escribir más de 40 (el tope por defecto) no sirve de nada, y con
masa 2 ya no suma pasar de 20. Por eso un bot pesado no puede acelerar tanto en un
solo ciclo. Moverse cuesta energía en proporción al empujón ya recortado.

<!-- 30-FISICA §2.1 (dir = up−dn, sx−dx); §2 (bot fijo sin fuerzas) -->
`.up` se combina con [[.dn]], [[.sx]] y [[.dx]]: el motor calcula `.up − .dn` y
`.sx − .dx` y empuja en la diagonal que resulta. Un valor negativo empuja hacia
atrás, igual que `.dn`. Un bot clavado con [[.fixpos]] no se mueve ni paga el
movimiento.

```adn
' avanza a fondo mientras le sobre energía
cond
*.nrg 1000 >
start
40 .up store
stop
```
