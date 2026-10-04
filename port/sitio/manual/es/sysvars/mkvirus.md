---
titulo: .mkvirus
resumen: "Copia el gen con ese número en un virus y empieza a incubarlo; después se dispara con .vshoot."
etiquetas: [virus, genes, acción]
estado: revisada
---
<!-- 35-VIRUS §0.2, §0.3, §1 (gate Vtimer = 0, mkvirus no se consume hasta el disparo, gen inválido no fabrica) -->
Escribí el número de uno de tus genes (con la numeración de
[[adn/genes#la-numeracion-de-los-genes]]) y el motor lo copia entero, de su `cond`
a su `stop`, en un virus que el bot guarda adentro. La copia cobra energía según el
largo del gen ([[param:cost:25]] por palabra) y arranca la incubación: [[.vtimer]]
pasa a valer el doble de palabras del gen y baja de a 1 por ciclo. Cuando llega a 1,
el virus espera a que escribas [[.vshoot]].

Detalles:

- **Un virus por vez.** Mientras haya uno incubando o esperando, otra escritura en
  `.mkvirus` no fabrica nada.
- **No se borra al fabricar**, sino al disparar. Mientras tanto la celda conserva el
  número del gen.
- **Un número de gen que no existe** no fabrica nada.
- **Sin cloroplastos.** Si el bot tiene cloroplastos, el intento no fabrica el virus
  y le quita todos los cloroplastos. Como la orden sigue escrita, el virus se
  fabrica en el ciclo siguiente.

```adn
' Fabrica un virus con su propio primer gen y lo dispara cuando está listo
cond
 *.vtimer 0 =
start
 1 .mkvirus store
 10 .vshoot store
stop
```

<!-- comprobado: .vtimer se lee 23, 22… y el virus sale 23 ciclos después de fabricado; al ciclo siguiente el gen vuelve a fabricar otro -->
Este gen tiene 12 palabras, así que la incubación arranca en 24. El virus sale
apenas la cuenta llega a 1, 23 ciclos después de fabricado, porque `.vshoot` quedó
escrita esperándolo. Después [[.vtimer]] vuelve a 0 y el gen fabrica otro. El gen copiado es justamente el que hace virus,
así que la víctima también empieza a fabricarlos. Pero ojo: en la víctima, el gen
insertado no tiene por qué ser el número 1, así que lo que ella copie depende de
dónde cayó. El ciclo completo está en [[sysvars/adn-y-virus]].
