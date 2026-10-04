---
titulo: .sharewaste
resumen: "En un multicelular, qué porcentaje del desecho sumado con cada compañero querés quedarte (1 a 99)."
etiquetas: [lazos, multicelular, desecho, compartir]
estado: revisada
---
Funciona como [[.sharenrg]], pero con el desecho ([[.waste]]): por cada lazo, el
motor suma tu desecho y el del compañero y te deja el porcentaje que pediste. Lo
interesante suele ser lo contrario de la energía: pedir **poco**, para pasarle tu
desecho a otra célula. Con 1 te quedás con casi nada.

Las condiciones son las mismas: solo si sos multicelular ([[.multi]]), solo por
los lazos que creaste vos con [[.tie]], y el motor borra la orden en cada ciclo.
El valor se recorta a 0…99 (un 100 cuenta como 99) y un 0 no hace nada. Acá no hay
tope por ciclo ni comisión: el reparto es inmediato.

<!-- sysvars.yaml .sharewaste (clamp 0..99 in place; =0 cada P3); 34-TIES §2 (gate > 0, ties no-back), §2.1 -->

```adn
' pasarle mi desecho a los compañeros
cond
*.multi 1 =
*.waste 100 >
start
1 .sharewaste store
stop
```

Otra forma de deshacerse de desecho por un lazo es [[.tieloc]] `-4`.
