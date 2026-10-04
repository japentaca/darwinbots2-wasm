---
titulo: .shareslime
resumen: "En un multicelular, qué porcentaje de la baba sumada con cada compañero querés quedarte (1 a 99)."
etiquetas: [lazos, multicelular, slime, compartir]
estado: revisada
---
Funciona como [[.sharenrg]], pero con la baba ([[.slime]]): por cada lazo, el
motor suma tu baba y la del compañero y te deja el porcentaje que pediste. Sirve
para que todo el organismo esté protegido contra lazos enemigos y virus aunque la
fabrique una sola célula.

Las condiciones son las mismas: solo si sos multicelular ([[.multi]]), solo por
los lazos que creaste vos con [[.tie]], y el motor borra la orden en cada ciclo.
El valor se recorta a 0…99 (100 cuenta como 99) y un 0 no hace nada. No hay tope
por ciclo ni comisión. El reparto es inmediato, pero `.slime` lo muestra con un
ciclo más de atraso que lo normal: el motor no la vuelve a publicar hasta el
ciclo siguiente.

<!-- sysvars.yaml .shareslime (clamp 0..99; =0 cada P3) y .slime (tras shareslime se refleja recién en el Upkeep siguiente); 34-TIES §2.1 -->

Tené en cuenta que la baba de un compañero también rechaza tus propios lazos: un
bot con más de 92 de baba no se deja atar por nadie.

<!-- 34-TIES §0.5 -->

```adn
' repartir la baba parejo con los compañeros
cond
*.multi 1 =
start
50 .shareslime store
stop
```
