---
titulo: .trefbody
resumen: "El cuerpo del bot atado del otro lado del lazo que estás leyendo."
etiquetas: [tref, lazos, cuerpo]
estado: revisada
---
<!-- sysvars.yaml .trefbody (CInt(body), tope 32000); 34-TIES §2; corte del lazo: valor viejo un ciclo, comprobado con probar-adn -->
Vale el [[.body]] del bot atado, redondeado a entero. Si el otro tiene 32000 o más
de cuerpo, leés 32000. Como todas las [[sysvars/tref|tref*]], describe al bot del lazo
elegido con [[.readtie]] (o el de [[.tiepres]]) y vuelve a 0 cuando ese lazo deja de
existir.

Sirve para comparar tamaños dentro de un grupo atado: decidir quién come, quién se
reproduce o quién le pasa recursos a quién. Junto con [[.trefnrg]] te da el estado
completo del compañero.

```adn
' Engorda mientras el atado tenga mas cuerpo que yo
cond
*.numties 0 >
*.trefbody *.body >
start
100 .strbody store
stop
```

El guardia `*.numties 0 >` evita usar el valor viejo que queda durante el ciclo en
que se corta el lazo (ver [[sysvars/tref#que-lazo]]).
