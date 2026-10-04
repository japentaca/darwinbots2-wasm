---
titulo: .shareshell
resumen: "En un multicelular, qué porcentaje del caparazón sumado con cada compañero querés quedarte (1 a 99)."
etiquetas: [lazos, multicelular, shell, compartir]
estado: revisada
---
Funciona como [[.sharenrg]], pero con el caparazón ([[.shell]]): por cada lazo, el
motor suma tu caparazón y el del compañero y te deja el porcentaje que pediste. Así
un organismo puede fabricar caparazón en una sola célula y repartirlo, o
concentrarlo en las del borde.

Las condiciones son las mismas: solo si sos multicelular ([[.multi]]), solo por
los lazos que creaste vos con [[.tie]], y el motor borra la orden en cada ciclo.
El valor se recorta a 0…99 (100 cuenta como 99) y un 0 no hace nada. No hay tope
por ciclo ni comisión. El nuevo `.shell` de los dos bots se publica en el acto.

<!-- sysvars.yaml .shareshell (clamp 0..99; =0 cada P3); 34-TIES §2.1 (publica mem(823) en ambos bots) -->

```adn
' repartir el caparazón parejo con los compañeros
cond
*.multi 1 =
start
50 .shareshell store
stop
```
