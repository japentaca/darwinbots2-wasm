---
titulo: .numties
resumen: "Cuántos lazos tiene el bot ahora, contando los de nacimiento y los que le hicieron otros."
etiquetas: [lazos, tie, sentidos]
estado: revisada
---
Cuenta todos los lazos del bot, sin importar quién los creó: el de nacimiento, los
que hiciste con [[.tie]] y los que otros te hicieron a vos. El máximo es 9. El
motor la actualiza cuando se crea o se borra un lazo y en cada ciclo al revisar
los lazos; escribir en ella no cambia nada.

<!-- sysvars.yaml .numties (Update_Ties P3, maketie, DeleteTie); 34-TIES §0.1 (máximo 9) -->

Sirve para decisiones simples: atarse solo si todavía no tenés lazo, soltar
lazos ajenos con [[.deltie]], o saber si sos una célula suelta. Un recién nacido
ya tiene 1, el lazo con el padre, que dura unos 100 ciclos si nadie lo
reemplaza. Para saber si además sos multicelular, mirá [[.multi]].

<!-- 34-TIES §0.4 (tie de nacimiento: last = 100) -->

```adn
' atarse a lo que veo solo si no tengo lazos
cond
*.numties 0 =
*.eye5 30 >
start
3 .tie store
stop
```
