---
titulo: .aim
resumen: "Hacia dónde apunta el bot, en una escala de 0 a 1255 donde 0 es la derecha de la pantalla y 314 es arriba."
etiquetas: [giro, rumbo, sentido]
estado: revisada
---
<!-- sysvars.yaml .aim (0..~2513 con momento angular); 30-FISICA §7 -->
`.aim` es el rumbo del bot: hacia dónde mira, hacia dónde empuja [[.up]] y desde
dónde se miden sus ojos. Una vuelta completa son 1256: 0 mira a la derecha de la
pantalla, 314 hacia arriba, 628 a la izquierda y 942 hacia abajo. El motor la
publica después de aplicar los giros de [[.aimsx]], [[.aimdx]] y [[.setaim]];
escribir en ella no gira al bot.

Si el bot gira por otras causas (un lazo que lo retuerce, el movimiento browniano)
el valor puede salirse un poco del rango 0-1255.

<!-- sysvars.yaml meta.al_nacer (mem 19 sembrada, mem 18 no) -->
:::cuidado
En el primer ciclo de vida `*.aim` vale 0, aunque el bot apunte a otro lado: el
motor todavía no lo publicó. El rumbo verdadero está en ese momento en
[[.setaim]], que el motor siembra al nacer. Un `*.aim 100 add .setaim store` en el
primer ciclo deja al bot en 100, no 100 más allá de donde estaba.
:::

<!-- sysvars.yaml .aim (lookoccurr -> 711) -->
Los demás bots ven tu rumbo en [[.refaim]] cuando te miran. Para dar media vuelta
alcanza con sumar media vuelta al rumbo actual:

```adn
' da media vuelta cuando algo lo toca por detrás
cond
*.hitdn 0 !=
start
*.aim 628 add .setaim store
stop
```

[[.setaim]] acepta cualquier número y se queda con su resto de dividir por 1256,
así que no hace falta corregir la suma.
