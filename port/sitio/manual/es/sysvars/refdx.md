---
titulo: .refdx
resumen: "Cuántas veces escribe en .dx el ADN del bot que estás viendo: una cifra de su firma de especie."
etiquetas: [visión, refvars, firma, reconocimiento]
estado: revisada
---
<!-- sysvars.yaml 704; core senses.hpp makeoccurrlist; probado: firma.txt (.dx inc cuenta 1) -->
Cuenta cuántas veces aparece en el ADN del bot visto la dirección de [[.dx]]
(la 4, empuje hacia la derecha) justo antes de una palabra de escritura. Vale
cualquier palabra de escritura, no solo [[op:store]]: un `.dx inc` también
suma 1.

Las reglas son las de toda la firma (ver [[.refup]]). Se compara con
[[.mydx]], y se suele mirar junto con [[.refsx]].

```adn
' ¿el otro sabe moverse de costado y yo no? me doy vuelta
cond
*.eye5 0 >
*.refdx 0 >
*.mydx 0 =
start
628 .aimdx store
stop
```
