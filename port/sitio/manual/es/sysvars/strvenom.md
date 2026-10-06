---
titulo: .strvenom
resumen: "Orden para fabricar veneno (venom): cada 1 de energía da 1 de veneno, hasta 100 por ciclo. También se llama .mkvenom."
etiquetas: [defensas, venom, energía, disparos]
estado: revisada
---
Escribí cuánto veneno querés sumar en este ciclo; `.mkvenom` es otro nombre para
la misma celda. El motor lo fabrica al final del ciclo, cobra 1 de energía por
cada 1 de veneno (es la más cara de las cuatro sustancias) y deja la orden en 0. El
tope es 100 por ciclo.

<!-- sysvars.yaml .strvenom (alias mkvenom; MakeStuff P5, ±100/ciclo, =0 al consumir); 31-ENERGIA §0.3 (1 nrg = 1 venom) -->

Como con [[.mkshell]], un valor negativo desarma veneno pero cobra energía igual,
se suma un costo de transacción que va a desecho, y con la energía en 0 o menos
la orden queda escrita sin ejecutarse. A diferencia del caparazón y la baba, acá
ser multicelular no abarata nada.

<!-- port/core robots.hpp storevenom (sin división por numties; guarda nrg > 0) -->

El veneno no se gasta solo: queda en [[.venom]] hasta que lo dispares con `-3` en
[[.shoot]] o lo pases por un lazo con [[.tieloc]].

```adn
' tener siempre 100 de veneno listo para disparar
cond
*.venom 100 <
*.nrg 500 >
start
100 .strvenom store
stop
```
